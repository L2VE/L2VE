"""
Main entry point for Discovery-With-Seed project
"""
import argparse
import asyncio
import os
from pathlib import Path
from typing import Any
from src.agents import DiscoveryAgent, AnalysisAgent
from src.config import (
    get_llm,
    MCP_CONFIG,
    DEFAULT_PROJECT_TITLE,
    DEFAULT_LLM_PROVIDER,
    DEFAULT_LLM_MODEL,
    get_analysis_targets,
    ANALYSIS_WORKERS_DEFAULT,
    ANALYSIS_WORKER_OVERRIDES,
    ANALYSIS_WORKER_MAX_RETRIES,
)
from src.utils.logging import init_logger
from langchain_mcp_adapters.client import MultiServerMCPClient

# LangSmith 연동
from langchain_teddynote import logging as teddy_logging
# Langfuse 연동 (v3: langfuse.langchain)
try:
    from langfuse.langchain import CallbackHandler as LangfuseCallbackHandler
    from langfuse import Langfuse
except ImportError:
    LangfuseCallbackHandler = None

from src.utils import fetch_unseen_vulnerabilities
from src.agents.discovery_agent.nodes import _apply_classifications_to_local_file  # type: ignore

def parse_args():
    parser = argparse.ArgumentParser(description="Run Discovery-With-Seed workflow.")
    parser.add_argument("--provider", type=str, help="LLM provider (google, groq, openai, azure, anthropic, compatible, openrouter)")
    parser.add_argument("--model", type=str, help="Override model name")
    parser.add_argument("--project", type=str, help="Project title")
    parser.add_argument("--mode", type=str, choices=["discovery", "analysis", "full"], help="Workflow mode")
    parser.add_argument("--use-env", action="store_true", help="Use environment defaults without prompts")
    parser.add_argument("--no-langsmith", action="store_true", help="Disable LangSmith even if keys exist")
    parser.add_argument("--no-langfuse", action="store_true", help="Disable Langfuse even if keys exist")
    parser.add_argument("--ignore-previous-versions", action="store_true", help="Ignore local latest analysis cache and re-run all elements")
    parser.add_argument("--input-seed-source", type=str, choices=["http", "json"], default="http", help="Seed source for discovery (http/json)")
    parser.add_argument("--input-seed-file", type=str, help="Path to JSON seed file when using --input-seed-source=json")
    return parser.parse_args()


def setup_tracing(project_name: str, enable_langsmith: bool, enable_langfuse: bool) -> list:
    """
    Setup Tracing (LangSmith and/or Langfuse)
    
    Args:
        project_name: Project name
        enable_langsmith: Whether to enable LangSmith
        enable_langfuse: Whether to enable Langfuse
        
    Returns:
        List of callbacks to be used in agents
    """
    callbacks = []
    
    print(f"\n{'='*80}")
    print(f"📊 TRACING SETUP")
    print(f"{'='*80}")
    
    # 1. Setup LangSmith
    if enable_langsmith:
        langsmith_api_key = os.getenv("LANGCHAIN_API_KEY") or os.getenv("LANGSMITH_API_KEY")
        if not langsmith_api_key:
            print("⚠️  LANGCHAIN_API_KEY not found. LangSmith disabled.")
        else:
            try:
                teddy_logging.langsmith(project_name)
                print(f"✅ LangSmith tracing ENABLED (Global)")
                print(f"   Project: {project_name}")
            except Exception as e:
                print(f"❌ Failed to enable LangSmith: {e}")
    else:
        print("   LangSmith tracing DISABLED (by argument)")

    # 2. Setup Langfuse
    if enable_langfuse:
        if LangfuseCallbackHandler is None:
            print("\n❌ Langfuse library not installed. Install with `pip install langfuse[langchain]`.")
        else:
            public_key = os.getenv("LANGFUSE_PUBLIC_KEY")
            secret_key = os.getenv("LANGFUSE_SECRET_KEY")
            base_url = os.getenv("LANGFUSE_BASE_URL") or os.getenv("LANGFUSE_HOST")
            
            if not (public_key and secret_key and base_url):
                 print("\n⚠️  Langfuse credentials missing (LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL/LANGFUSE_HOST).")
                 print("   Langfuse tracing will be DISABLED.")
            else:
                try:
                    # v3: instantiate client once (env vars also work); handler pulls from singleton
                    Langfuse(public_key=public_key, secret_key=secret_key, base_url=base_url)
                    langfuse_handler = LangfuseCallbackHandler()
                    callbacks.append(langfuse_handler)
                    print(f"\n✅ Langfuse tracing ENABLED (Callback)")
                    print(f"   Host: {base_url}")
                except Exception as e:
                    print(f"\n❌ Failed to initialize Langfuse handler: {e}")
    else:
        print("\n   Langfuse tracing DISABLED (by argument)")

    print(f"{'='*80}\n")
    return callbacks


async def activate_mcp_project(mcp_client, project_name: str):
    """
    Activate MCP project workspace
    
    Args:
        mcp_client: MCP client instance
        project_name: Project name to activate
    """
    print(f"\n{'='*80}")
    print(f"🔧 MCP PROJECT ACTIVATION")
    print(f"{'='*80}")
    print(f"Project: {project_name}")
    
    try:
        print(f"\n📡 Fetching MCP tools...")
        tools = await mcp_client.get_tools()
        
        print(f"✅ Received {len(tools)} tools from MCP server")
        print(f"\nAvailable tools:")
        for i, tool in enumerate(tools, 1):
            print(f"  {i}. {tool.name}")
        
        print(f"\n🔍 Looking for 'activate_project' tool...")
        activate_tool = None
        for tool in tools:
            if tool.name == "activate_project":
                activate_tool = tool
                break
        
        if activate_tool:
            print(f"✅ Found 'activate_project' tool")
            print(f"\n📤 Invoking activate_project with: {{'project': '{project_name}'}}")
            result = await activate_tool.ainvoke({"project": project_name})
            print(f"\n📥 Activation result:")
            print(f"{result}")
            print(f"\n✅ MCP project activated: {project_name}")
            print(f"{'='*80}\n")
            return True
        else:
            print(f"⚠️  'activate_project' tool not found in MCP server")
            print(f"    This is OK - MCP tools will work without project activation")
            print(f"{'='*80}\n")
            return True  # Changed to True - tools are available
    except Exception as e:
        print(f"\n❌ MCP activation failed")
        print(f"Error: {e}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        print(f"\nFull traceback:")
        traceback.print_exc()
        print(f"{'='*80}\n")
        return False


async def run_discovery(
    project_title: str,
    llm,
    mcp_client,
    provider: str,
    seed_source: str = "http",
    seed_file: str | None = None,
    workers: int | None = None,
    callbacks: list | None = None,
):
    """
    Run Discovery Agent
    
    Args:
        project_title: Project title for API
        llm: Language model instance
        mcp_client: MCP client instance
        provider: LLM provider name
        callbacks: List of tracing callbacks
    """
    print("="*80)
    print("🔍 DISCOVERY PHASE")
    print("="*80)
    print(f"Project: {project_title}\n")
    
    # 중앙에서 요소를 로드 (API 또는 로컬 파일)
    discovery_agent = DiscoveryAgent(
        llm,
        mcp_client,
        provider,
        seed_source=seed_source,
        seed_file=seed_file,
    )

    # Load elements
    if seed_source == "json":
        local_seed_file = discovery_agent._ensure_local_seed_file(project_title)
        elements = [
            elem for elem in discovery_agent._load_seed_payload(Path(local_seed_file))
            if not elem.get("vulnerability_types")
        ]
    else:
        elements = await fetch_unseen_vulnerabilities(project_title)
        local_seed_file = None

    result = await discovery_agent.classify_elements(
        project_title, 
        elements, 
        worker_count=workers,
        callbacks=callbacks
    )

    # Apply updates (API or local file) centrally
    try:
        if seed_source == "json" and local_seed_file:
            updated_count, total_entries = _apply_classifications_to_local_file(
                local_seed_file,
                result.get("classified_entries", [])
            )
            result["messages"].append(
                f"Persisted {updated_count}/{len(result.get('classified_entries', []))} to {local_seed_file}"
            )
            result["discovery_output_file"] = local_seed_file
        else:
            api_result = await batch_update_vulnerabilities(project_title, result.get("classified_entries", []))
            if "error" in api_result:
                result["messages"].append(f"Backend update error: {api_result['error']}")
            else:
                result["messages"].append(f"Updated backend with {len(result.get('classified_entries', []))} elements")
    except Exception as exc:
        result["messages"].append(f"Update failed: {exc}")
    
    print("\n" + "="*80)
    print("Discovery Results")
    print("="*80)
    print(f"Total classified: {result['total_classified']}")
    print(f"Status: {result['stage']}")
    print("="*80 + "\n")
    output_file = result.get("discovery_output_file")
    if output_file:
        print(f"💾 Saved discovery results to {output_file}\n")
    
    return result


def build_target_system_prompt(label: str, cwe: str | None, description: str, extra_instructions: str | None = None) -> str:
    """
    Create a CWE-specific prefix that is prepended to the base analysis prompt.
    """
    focus_lines = [
        f"You are the dedicated analysis agent for {label} vulnerabilities."
    ]
    if cwe:
        focus_lines.append(f"- CWE reference: {cwe}")
    if description:
        focus_lines.append(f"- Key traits: {description}")
    focus_lines.extend(
        [
            "- Reject findings that do not clearly match this vulnerability type.",
            "- Gather concrete evidence (file paths + line numbers) that proves this vulnerability class.",
        ]
    )
    if extra_instructions:
        focus_lines.append("- " + extra_instructions)
    return "\n".join(focus_lines)


def parse_worker_overrides(value: str) -> dict[str, int]:
    overrides: dict[str, int] = {}
    if not value:
        return overrides
    for entry in value.split(","):
        if not entry.strip():
            continue
        if "=" not in entry:
            continue
        key, raw = entry.split("=", 1)
        key = key.strip().upper()
        try:
            count = int(raw.strip())
        except ValueError:
            continue
        if count < 1:
            continue
        overrides[key] = count
    return overrides


async def run_analysis(
    project_title: str,
    llm,
    mcp_client,
    provider: str,
    analysis_targets: list[dict[str, Any]] | None = None,
    classification_source: str = "http",
    classification_file: str | None = None,
    ignore_previous_versions: bool = False,
    callbacks: list | None = None,
):
    """
    Run Analysis Agents (one per vulnerability category).
    """
    print("="*80)
    print("🔬 ANALYSIS PHASE")
    print("="*80)
    print(f"Project: {project_title}\n")

    targets = analysis_targets or get_analysis_targets()
    if not targets:
        print("⚠️  No analysis targets configured. Skipping analysis phase.")
        return {"project_title": project_title, "stage": "skipped", "targets": []}

    worker_overrides = parse_worker_overrides(ANALYSIS_WORKER_OVERRIDES)
    default_workers = max(1, ANALYSIS_WORKERS_DEFAULT)
    max_worker_retries = max(0, ANALYSIS_WORKER_MAX_RETRIES)

    print("Launching analysis workers per vulnerability category:\n")
    normalized_targets = []
    for target in targets:
        label = target.get("label")
        cwe = target.get("cwe")
        description = target.get("description", "")
        analysis_prompt = target.get("analysis_prompt", "")
        target_is_general = target.get("is_general", False)
        system_prompt = build_target_system_prompt(label, cwe, description, analysis_prompt)
        label_key = (label or "").upper()
        worker_count = max(1, worker_overrides.get(label_key, default_workers))
        print(f"  • {label} ({cwe or 'n/a'}) using {worker_count} worker(s)")

        async def run_worker(worker_idx: int):
            attempt = 0
            last_error: Exception | None = None
            while attempt <= max_worker_retries:
                try:
                    agent = AnalysisAgent(
                        llm,
                        mcp_client,
                        provider,
                        classification_source=classification_source,
                        classification_file=classification_file,
                        ignore_previous_versions=ignore_previous_versions,
                        target_label=label,
                        target_cwe=cwe,
                        system_prompt=system_prompt,
                        target_is_general=target_is_general,
                    )
                    result = await agent.analyze(
                        project_title,
                        worker_id=worker_idx,
                        worker_count=worker_count,
                        callbacks=callbacks
                    )
                    stage = result.get("stage")
                    if stage == "completed":
                        return {
                            "worker_id": worker_idx,
                            "stage": stage,
                            "result": result,
                        }
                    last_error = RuntimeError(f"Stage {stage}")
                except Exception as exc:  # pylint: disable=broad-except
                    last_error = exc
                attempt += 1
                if attempt <= max_worker_retries:
                    print(
                        f"     ↻ Worker {worker_idx + 1}/{worker_count} for {label} retrying"
                        f" ({attempt}/{max_worker_retries})"
                    )
            return {
                "worker_id": worker_idx,
                "stage": "error",
                "error": str(last_error) if last_error else "Unknown error",
            }

        worker_tasks = [asyncio.create_task(run_worker(idx)) for idx in range(worker_count)]
        worker_results = await asyncio.gather(*worker_tasks)

        completed_workers = sum(1 for r in worker_results if r.get("stage") == "completed")
        if completed_workers == worker_count:
            target_stage = "completed"
        elif completed_workers == 0:
            target_stage = "error"
            print(f"❌ {label}: all workers failed")
        else:
            target_stage = "partial"

        for r in worker_results:
            status = r.get("stage")
            if status == "completed":
                analyzed = r.get("result", {}).get("total_analyzed", 0)
                print(f"     ✅ Worker {r['worker_id'] + 1}: analyzed {analyzed} elements")
            else:
                print(f"     ❌ Worker {r['worker_id'] + 1}: {r.get('error', 'failed')}")

        normalized_targets.append({
            "label": label,
            "cwe": cwe,
            "description": description,
            "is_general": target_is_general,
            "worker_count": worker_count,
            "stage": target_stage,
            "workers": worker_results,
        })

    total_targets = len(normalized_targets)
    completed_targets = sum(1 for t in normalized_targets if t["stage"] == "completed")
    if completed_targets == total_targets:
        overall_stage = "completed"
    elif completed_targets == 0:
        overall_stage = "error"
    else:
        overall_stage = "partial"

    if overall_stage == "completed":
        from pathlib import Path
        latest_file = Path("analysis_results") / f"{project_title}_latest.json"
        if latest_file.exists():
            print(f"\n✅ Analysis complete! Results saved to:")
            print(f"   {latest_file.absolute()}\n")

    print(
        f"\nCompleted {completed_targets}/{total_targets} vulnerability types"
        f" (overall stage={overall_stage}).\n"
    )

    return {
        "project_title": project_title,
        "stage": overall_stage,
        "targets": normalized_targets,
    }


async def main():
    """
    Main execution function
    """
    args = parse_args()
    seed_source = (args.input_seed_source or "http").lower()
    seed_file = args.input_seed_file
    if seed_source == "json" and not seed_file:
        print("Error: --input-seed-file is required when --input-seed-source=json")
        return
    ignore_previous_versions = args.ignore_previous_versions

    env_provider = DEFAULT_LLM_PROVIDER
    env_model = DEFAULT_LLM_MODEL

    provider = None
    model_name = None

    if args.provider:
        provider = args.provider.lower()
        model_name = args.model
        print(f"\nUsing provider from arguments: {provider} - {model_name or 'default'}")
    elif args.use_env and env_provider:
        provider = env_provider
        model_name = args.model if args.model else env_model
        print(f"\nUsing environment defaults: {provider} - {model_name or 'default'}")
    elif env_provider:
        print(f"\nEnvironment settings detected:")
        print(f"   Provider: {env_provider}")
        print(f"   Model: {env_model or 'default'}")
        choice = input("\nUse these settings? (Y/n): ").strip().lower()
        if choice in ['', 'y', 'yes']:
            provider = env_provider
            model_name = env_model
            print(f"Using environment settings: {provider} - {model_name or 'default'}\n")

    allowed_providers = {"google", "groq", "openai", "azure", "anthropic", "compatible", "openrouter", "bedrock"}

    if provider is None:
        print("\nSelect LLM Provider:")
        print("1. Google Gemini (default)")
        print("2. Groq")
        print("3. OpenAI")
        print("4. Azure OpenAI")
        print("5. Anthropic Claude")
        print("6. OpenAI Compatible (vLLM, LocalAI, Ollama, etc.)")
        print("7. OpenRouter (openrouter.ai)")

        provider_choice = input("Enter choice (1/2/3/4/5/6/7, default: 1): ").strip()
        provider_map = {
            "1": "google",
            "2": "groq",
            "3": "openai",
            "4": "azure",
            "5": "anthropic",
            "6": "compatible",
            "7": "openrouter",
            "": "google"
        }
        provider = provider_map.get(provider_choice, "google")

        print(f"\nSelected provider: {provider.upper()}")
        print("Enter model name (press Enter for default):")
        if provider == "google":
            print("  Default: gemini-2.0-flash-exp")
            print("  Options: gemini-1.5-pro, gemini-1.5-flash")
        elif provider == "groq":
            print("  Default: qwen/qwen3-32b")
            print("  Options: llama-3.1-70b-versatile, mixtral-8x7b-32768")
        elif provider == "openai":
            print("  Default: gpt-4o-mini")
            print("  Options: gpt-4o, gpt-4-turbo, gpt-5 (if available), o1-preview, o1-mini")
        elif provider == "azure":
            print(f"  Default: {os.getenv('AZURE_OPENAI_DEPLOYMENT_NAME', 'from .env')}")
        elif provider == "anthropic":
            print("  Default: claude-sonnet-4-5-20250929")
            print("  Options: claude-3.5-sonnet, claude-3-haiku, etc.")
        elif provider == "compatible":
            print(f"  Default: {os.getenv('OPENAI_COMPATIBLE_MODEL', 'from .env')}")
            print(f"  Base URL: {os.getenv('OPENAI_COMPATIBLE_BASE_URL', 'from .env')}")
        elif provider == "openrouter":
            print("  Default: x-ai/grok-4.1-fast")
            print("  Base URL: https://openrouter.ai/api/v1 (overridable via OPENROUTER_BASE_URL)")

        model_name = input("Model: ").strip() or None
    else:
        if provider not in allowed_providers:
            raise ValueError(f"Unsupported provider '{provider}'. Supported providers: {sorted(allowed_providers)}")
        if model_name:
            print(f"   Model override: {model_name}")

    try:
        llm = get_llm(provider=provider, model_name=model_name)
        print("[DEBUG] llm: ", llm)
        print(f"LLM initialized: {provider} - {model_name or 'default model'}\n")
    except ValueError as e:
        print(f"Error: {e}")
        return

    if args.project is not None:
        project_title = args.project.strip() or DEFAULT_PROJECT_TITLE
        print(f"Using project title from arguments: {project_title}")
    else:
        project_title = input(f"Enter project title (default: {DEFAULT_PROJECT_TITLE}): ").strip()
        if not project_title:
            project_title = DEFAULT_PROJECT_TITLE

    if not project_title:
        print("Error: No project title provided")
        return

    print(f"\nProject Title: {project_title}\n")

    # Setup Tracing
    tracing_callbacks = setup_tracing(
        f"discovery-with-seed-{project_title}",
        enable_langsmith=not args.no_langsmith,
        enable_langfuse=not args.no_langfuse
    )

    logger = init_logger(project_title)
    print(f"Communication log: {logger.get_log_file_path()}\n")

    print("\n" + "=" * 80)
    print("INITIALIZING MCP CLIENT")
    print(f"{'='*80}")
    print("MCP Config:")
    for server_name, config in MCP_CONFIG.items():
        print(f"  Server: {server_name}")
        print(f"    Transport: {config.get('transport')}")
        print(f"    URL: {config.get('url')}")
    print(f"{'='*80}\n")

    mcp_client = MultiServerMCPClient(MCP_CONFIG)
    print("MCP client created\n")

    try:
        mcp_activated = await activate_mcp_project(mcp_client, project_title)

        if not mcp_activated:
            print("Warning: MCP not activated, proceeding anyway...")

        if args.mode:
            mode_map = {"discovery": "1", "analysis": "2", "full": "3"}
            mode = mode_map[args.mode]
            print(f"\nUsing mode from arguments: {args.mode} ({mode})")
        else:
            print("\nSelect mode:")
            print("1. Discovery only")
            print("2. Analysis only")
            print("3. Full workflow (Discovery -> Analysis)")
            mode = input("Enter choice (1/2/3): ").strip()

        analysis_source = "json" if seed_source == "json" else "http"
        discovery_output_file = None

        if mode == "1":
            await run_discovery(
                project_title,
                llm,
                mcp_client,
                provider,
                seed_source=seed_source,
                seed_file=seed_file,
                workers=None,
                callbacks=tracing_callbacks
            )
        elif mode == "2":
            classification_file = None
            if analysis_source == "json":
                classification_file = seed_file
                if classification_file:
                    print(f"\n📄 Using classification file for analysis: {classification_file}")
                else:
                    print("\n⚠️  JSON classification source selected but no file provided")
            await run_analysis(
                project_title,
                llm,
                mcp_client,
                provider,
                classification_source=analysis_source,
                classification_file=classification_file,
                ignore_previous_versions=ignore_previous_versions,
                callbacks=tracing_callbacks
            )
        elif mode == "3":
            print("\nRunning full workflow...\n")
            discovery_result = await run_discovery(
                project_title,
                llm,
                mcp_client,
                provider,
                seed_source=seed_source,
                seed_file=seed_file,
                workers=None,
                callbacks=tracing_callbacks
            )
            discovery_output_file = discovery_result.get("discovery_output_file")

            if discovery_result['stage'] == 'completed':
                print("Discovery completed successfully\n")
                analysis_result = await run_analysis(
                    project_title,
                    llm,
                    mcp_client,
                    provider,
                    classification_source=analysis_source,
                    classification_file=discovery_output_file if analysis_source == "json" else None,
                    ignore_previous_versions=ignore_previous_versions,
                    callbacks=tracing_callbacks
                )

                if analysis_result['stage'] == 'completed':
                    print("Analysis completed successfully\n")
                else:
                    print("Analysis incomplete\n")
            else:
                print("Discovery incomplete, skipping analysis\n")
        else:
            print("Invalid choice\n")

    finally:
        pass

    print("\n" + "="*80)
    print("Workflow Complete!")
    print("="*80)



if __name__ == "__main__":
    asyncio.run(main())
