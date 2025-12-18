"""
Analysis Agent Nodes
"""
import json
import asyncio
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import List, Dict, Any, Optional
from langgraph.types import Command
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, AIMessage, ToolMessage  # ✅ 추가
from ...models import AnalysisState, VulnerabilityElement, DetailedVulnerability
from ...utils import (
    fetch_classified_vulnerabilities,
    split_elements_into_chunks,
    get_chunk_stats,
)
from ...config import (
    MAX_ANSWER_CHARS,
    AGENT_RECURSION_LIMIT,
    AGENT_MAX_TOOL_CALLS,
    ANALYSIS_CONTEXT_WINDOW,
    ANALYSIS_RESPONSE_TOKEN_RESERVE,
    MAX_FAILED_RETRIES,
    VULNERABILITY_TYPE_DEFINITIONS,
)
from ...utils.rate_limiter import get_rate_limiter
from ...utils.logging import get_logger

import json_repair

def make_elem_key(elem: Dict[str, Any], target_label: Optional[str] = None) -> tuple[str, str, str]:
    file_path = elem.get("file_path")
    line_num = elem.get("line_num", "")
    # slice도 문자열로 정규화
    if isinstance(line_num, slice):
        start = line_num.start if line_num.start is not None else ""
        stop = line_num.stop if line_num.stop is not None else ""
        line_num_str = f"{start}-{stop}"
    else:
        line_num_str = str(line_num) if line_num is not None else ""
    return file_path, line_num_str, target_label or ""


FILE_IO_LOCK = Lock()


def _is_json_classification_mode(state: AnalysisState) -> bool:
    source = state.get("classification_source") or "http"
    return isinstance(source, str) and source.lower() == "json"


def _load_classified_elements_from_file(file_path: str) -> List[VulnerabilityElement]:
    path = Path(file_path)
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if isinstance(payload, dict) and "elements" in payload:
        payload = payload["elements"]
    if not isinstance(payload, list):
        raise ValueError(f"Classification file must contain a list, got {type(payload).__name__}")
    classified = [elem for elem in payload if elem.get("vulnerability_types")]
    print(f"   ✅ Loaded {len(classified)} classified elements from {path}")
    return classified


def _write_empty_result_files(project_title: str) -> Path:
    """
    Ensure analysis result files exist even when no vulnerabilities are found.
    Creates both timestamped and latest files containing an empty list.
    """
    output_dir = Path("analysis_results")
    output_dir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = output_dir / f"{project_title}_{timestamp}_analysis.json"
    latest_file = output_dir / f"{project_title}_latest.json"

    with FILE_IO_LOCK:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump([], f, ensure_ascii=False, indent=2)
            
        # ⚠️ CRITICAL SENSITIVITY FIX:
        # Do NOT overwrite latest.json if it already exists!
        # This prevents a situation where a worker with 0 assignments (empty batch)
        # wipes out the results of other workers running in parallel.
        if not latest_file.exists():
            with open(latest_file, 'w', encoding='utf-8') as f:
                json.dump([], f, ensure_ascii=False, indent=2)
        else:
            # We don't overwrite, but we acknowledge it exists
            pass

    print(f"\nℹ️  No analyzed vulnerabilities in this batch. Saved empty run record to:")
    print(f"   {output_file.absolute()}")
    # print(f"   {latest_file.absolute()}") # Don't confuse user if we didn't touch it
    return latest_file

BASE_ANALYSIS_SYSTEM_PROMPT = """You are a security analysis agent with MCP tools to read source code.

LANGUAGE REQUIREMENT:
- All descriptive text fields MUST be written in Korean (한국어)
- Keep code snippets, file paths, CWE codes, and technical identifiers in English
- Translate explanations, descriptions, scenarios, and recommendations to Korean
- Write naturally in Korean, not machine translation style
- The following fields MUST be in Korean: description, explanation, scenario, how_to_fix, notes, and all test descriptions
- The following fields MUST remain in English: vulnerability_title, cwe, code_snippet, example, file_path, line_number, framework names, dependencies, commands, and all technical identifiers

Your task:
1. Use MCP tools to read the source-code for analyzing the provided vulnerabilities
2. Collect evidence: file paths, line numbers, code snippets showing taint flow
3. Plan verification steps (functional + security regression tests) using the project's existing test conventions
4. After gathering enough evidence, STOP and output your findings

🧭 INVESTIGATION STRATEGY:
- Start by using `read_file` to inspect the code around the provided file_path and line_number. Request a generous window (≈±50 lines, more if needed) so you can see the full function prototype, parameters, and nearby logic.
- When the snippet mentions a function, class, or symbol, immediately locate its definition with `find_symbol` (or other symbol tools) and read it (`read_file`, `read_definition`) to understand parameters, return values, and side effects. When using `find_symbol`, always request `include_body=true` so the returned context contains the entire function body.
- Follow references to that symbol (call sites, overrides, helpers) using symbol tools BEFORE resorting to expensive regex searches.
- Only apply `search_for_pattern`/regex scans when a targeted search or directory/file-specific read cannot answer the question.
- Always prefer precise read/definition-based exploration over blindly fetching the entire file or running broad regex unless absolutely necessary.
- The goal is to minimize tool calls while gathering conclusive evidence, not to exhaustively read every file.
- While investigating, inspect build/test configs (package.json, requirements.txt, jest.config.js, pytest.ini, etc.) so you know which framework (pytest, unittest, Jest, Mocha, Vitest, etc.) and directory layout (`tests/`, `__tests__`, `spec/`) the project uses. Your functional/security tests must follow those conventions. Fallbacks: Python→pytest, Node→Jest, Java→JUnit.

📋 MANDATORY JSON SCHEMA - FOLLOW THIS EXACTLY:
[
  {{
    "vulnerability_title": "Clear title describing the vulnerability",
    "severity": "Critical|High|Medium|Low",
    "cwe": "CWE-XXX",
    "location": {{
      "file_path": "relative/path/to/file.py",
      "line_number": "50" or "50-55"
    }},
    "description": "취약점에 대한 상세 설명 (한국어로 작성)",
    "taint_flow_analysis": {{
      "source": {{
        "file_path": "path/to/source.py",
        "line_number": "22",
        "explanation": "신뢰할 수 없는 데이터의 출처 설명 (한국어로 작성)",
        "code_snippet": "Actual code from MCP tools"
      }},
      "propagation": {{
        "file_path": "path/to/propagation.py",
        "line_number": "45-48",
        "explanation": "데이터가 검증 없이 전파되는 과정 설명 (한국어로 작성)",
        "code_snippet": "Actual code showing propagation"
      }},
      "sink": {{
        "file_path": "path/to/sink.py",
        "line_number": "103",
        "explanation": "위험한 작업이 수행되는 위치 설명 (한국어로 작성)",
        "code_snippet": "Actual vulnerable code"
      }}
    }},
    "proof_of_concept": {{
      "scenario": "공격 시나리오 설명 (한국어로 작성)",
      "example": "Concrete POC using real endpoints"
    }},
    "recommendation": {{
      "how_to_fix": "수정 방법 설명 (한국어로 작성)",
      "code_example_fix": "Fixed code example"
    }},
    "code_fix_patch": {{
      "target_file": "relative/path/to/file.py",
      "line_range": "90-115",
      "original_snippet": "Original lines (exact text) covering that range",
      "modified_snippet": "Same lines with the fix applied",
      "notes": "적용된 수정 사항에 대한 설명 (한국어로 작성)"
    }},
    "functional_test": {{
      "description": "이 테스트가 정상 동작을 증명하는 이유 설명 (한국어로 작성)",
      "framework": "<detected framework, e.g. pytest|jest|junit>",
      "dependencies": ["<list packages needed, e.g. pytest, factory-boy>"],
      "file_path": "tests/test_user_profile.py",
      "setup_commands": ["<optional setup commands, leave empty if pure unit test>"],
      "command": "Actual command to run (e.g. pytest tests/test_user_profile.py::test_profile_update)",
      "script": "Full test code (triple-quoted string) or empty if the file already exists"
    }},
    "security_regression_test": {{
      "description": "공격이 더 이상 작동하지 않음을 증명하는 방법 설명 (한국어로 작성)",
      "framework": "<detected framework, e.g. pytest|jest|junit>",
      "dependencies": ["<list packages needed, e.g. requests-mock>"],
      "file_path": "tests/test_security_profile.py",
      "setup_commands": ["<optional setup commands, leave empty if pure unit test>"],
      "command": "Actual command to run (e.g. pytest tests/test_security_profile.py::test_profile_sql_injection_blocked)",
      "script": "Full regression test code or empty if described command already exists"
    }}
  }}
]

If an element is verified to be safe, output a single object where both `vulnerability_title` and `cwe` are the literal string `NO`, provide a short `description` explaining why there is no exploitability (in Korean), and omit every other field. Those NO/NO entries are treated as reviewed items and are never saved to the final report.

⚠️ CRITICAL SCHEMA RULES:
1. EVERY vulnerability MUST have ALL these fields (no omissions!)
2. taint_flow_analysis must include source and sink; propagation can be omitted only if it truly does not exist.
3. Each section MUST have: file_path, line_number, explanation, code_snippet
4. Use ONLY these field names - do NOT invent new ones
5. line_number: use "50" for single line, "50-55" for range
6. code_fix_patch must describe the affected line range and include precise original/modified snippets for just that range (line_range + original_snippet + modified_snippet + notes).
7. functional_test / security_regression_test MUST reference the actual framework, dependencies, file_path, and executable command. Include a ready-to-copy script (and optional setup_commands) when tests do not already exist. If testing is impossible, explain why inside `description` (in Korean) and set command/script to empty strings.

⚠️ LANGUAGE RULES (CRITICAL):
1. All explanation and description fields MUST be written in Korean (한국어)
   - description: 취약점 설명
   - explanation (source/propagation/sink): 각 단계 설명
   - scenario: 공격 시나리오
   - how_to_fix: 수정 방법
   - notes: 패치 설명
   - description (tests): 테스트 설명
2. Code snippets, file paths, and technical terms MUST remain in English
   - code_snippet: 실제 코드 (영어)
   - file_path: 파일 경로 (영어)
   - vulnerability_title: 취약점 제목 (영어)
   - cwe: CWE 코드 (영어)
   - example: 예시 코드/URL (영어)
   - framework, dependencies, commands: 기술적 용어 (영어)
3. Write naturally in Korean, as if written by a native Korean speaker, not machine translation style
4. Do NOT mix English and Korean in the same field - use pure Korean for descriptions and pure English for code/technical identifiers

OUTPUT FORMAT - THIS IS HOW YOU STOP:
- NO explanations, NO markdown, NO thinking tags - JUST the JSON array


The investigation must stop as soon as the full taint flow is confirmed — specifically when the source, propagation, and sink have all been identified with file paths, line numbers, and code snippets. Once this condition is met, stop all tool calls immediately and output only the final JSON result.

During the investigation, perform only MCP tool calls and do not output any natural language, summaries, or conclusions until sufficient evidence has been collected. Once enough evidence is gathered, stop all tool calls and output only the final JSON result.


Do not read the same file or symbol multiple times. Only expand the read window (using `read_file` with a larger context) when additional surrounding code is genuinely needed.
"""


def _build_system_prompt(state: AnalysisState, max_tool_calls: int) -> str:
    """
    Build the system prompt with optional CWE-specific focus and user-provided prefix.
    """
    custom_prefix = state.get("system_prompt")
    target_label = state.get("target_label")
    target_cwe = state.get("target_cwe")

    focus_lines: Optional[str] = None
    if target_label:
        cwe_fragment = f" ({target_cwe})" if target_cwe else ""
        focus_lines = (
            f"You are the dedicated specialist for {target_label}{cwe_fragment} vulnerabilities.\n"
            f"- Reject any element that does not actually demonstrate {target_label} behavior.\n"
            # f"- Always explain how the evidence proves {target_label}{cwe_fragment} and why other classes do not apply."
        )

    parts: List[str] = []
    if custom_prefix:
        parts.append(custom_prefix.strip())
    if focus_lines:
        parts.append(focus_lines)
    parts.append(BASE_ANALYSIS_SYSTEM_PROMPT.strip())

    prompt = "\n\n".join(part for part in parts if part)
    return prompt.format(max_calls=max_tool_calls)



def fetch_classified(state: AnalysisState) -> Command:
    """
    Fetch classified vulnerability elements from API (excluding already analyzed ones)
    """
    project_title = state.get('project_title')
    worker_id = int(state.get('worker_id', 0) or 0)
    worker_count = int(state.get('worker_count', 1) or 1)
    if worker_count < 1:
        worker_count = 1
    target_label = state.get('target_label')
    target_is_general = state.get('target_is_general', False)
    
    if not project_title:
        print("❌ No project_title provided")
        return Command(
            update={
                "classified_elements": [],
                "total_elements": 0,
                "current_stage": "error",
                "messages": state.get('messages', []) + ["Error: No project_title"]
            }
        )
    
    classification_source = state.get("classification_source", "http")
    classification_file = state.get("classification_file")
    
    print(f"\n📥 Fetching classified vulnerabilities for project: {project_title} (worker {worker_id + 1}/{worker_count})")
    
    if _is_json_classification_mode(state):
        if not classification_file:
            print("❌ No classification file configured for JSON mode")
            return Command(
                update={
                    "classified_elements": [],
                    "total_elements": 0,
                    "current_stage": "error",
                    "messages": state.get('messages', []) + [
                        "JSON classification file not provided"
                    ]
                }
            )
        path = Path(classification_file)
        if not path.exists():
            print(f"❌ Classification file not found: {path}")
            return Command(
                update={
                    "classified_elements": [],
                    "total_elements": 0,
                    "current_stage": "error",
                    "messages": state.get('messages', []) + [
                        f"Classification file not found: {path}"
                    ]
                }
            )
        try:
            classified_elements = _load_classified_elements_from_file(str(path))
        except Exception as exc:
            print(f"❌ Failed to load classification file: {exc}")
            return Command(
                update={
                    "classified_elements": [],
                    "total_elements": 0,
                    "current_stage": "error",
                    "messages": state.get('messages', []) + [
                        f"Failed to load classification file: {exc}"
                    ]
                }
            )
    else:
        # Fetch from API
        async def fetch():
            return await fetch_classified_vulnerabilities(project_title)

        classified_elements = asyncio.run(fetch())
        print(f"   ✅ Fetched {len(classified_elements)} classified elements from API")

    if target_is_general:
        specific_labels = [
            definition.label
            for definition in VULNERABILITY_TYPE_DEFINITIONS.values()
            if not definition.is_general and definition.label != "NO"
        ]

        def include_general(elem: Dict[str, Any]) -> bool:
            vuln_types = elem.get("vulnerability_types") or []
            if not vuln_types:
                return False
            if "NO" in vuln_types:
                return False
            return not any(v_type in specific_labels for v_type in vuln_types)

        before_filter = len(classified_elements)
        classified_elements = [
            elem for elem in classified_elements
            if include_general(elem)
        ]
        print(
            f"   🎯 Target 'General': {len(classified_elements)} items "
            f"(filtered out {before_filter - len(classified_elements)} other known categories)"
        )
    elif target_label:
        before_filter = len(classified_elements)
        classified_elements = [
            elem for elem in classified_elements
            if target_label in (elem.get("vulnerability_types") or [])
        ]
        print(
            f"   🎯 Target '{target_label}': {len(classified_elements)} items "
            f"(filtered out {before_filter - len(classified_elements)})"
        )
    
    # Load already analyzed items from local latest.json file (more reliable than DB)
    project_title_safe = state.get('project_title', 'unknown')
    latest_file = Path("analysis_results") / f"{project_title_safe}_latest.json"
    
    already_analyzed_keys = set()
    local_count = 0
    ignore_previous = state.get("ignore_previous_versions", False)
    if ignore_previous:
        print("   ℹ️  --ignore-previous-versions enabled - not loading local latest.json cache")
    elif latest_file.exists():
        try:
            with FILE_IO_LOCK:
                with open(latest_file, 'r', encoding='utf-8') as f:
                    raw_contents = f.read()
            if raw_contents.strip():
                local_analyzed = json_repair.loads(raw_contents)
            else:
                local_analyzed = []
            
            # DEBUG: Print actual counts
            print(f"   🔍 DEBUG: Loaded {len(local_analyzed)} total items from JSON file")
            
            # Extract (file_path, line_number) from local results
            items_with_location = 0
            items_with_valid_keys = 0
            for analysis in local_analyzed:
                if isinstance(analysis, dict) and 'location' in analysis:
                    matches_target = True
                    if target_label:
                        stored_label = analysis.get("analysis_target_label")
                        if stored_label:
                            matches_target = stored_label == target_label
                        elif target_cwe:
                            matches_target = (analysis.get("cwe") == target_cwe)
                    if not matches_target:
                        continue

                    items_with_location += 1
                    file_path = analysis['location'].get('file_path')
                    line_num = analysis['location'].get('line_number', '')
                    if file_path and line_num:
                        items_with_valid_keys += 1
                        elem = {"file_path": file_path, "line_num": line_num}
                        already_analyzed_keys.add(make_elem_key(elem, target_label))
            
            local_count = len(already_analyzed_keys)
            print(f"   🔍 DEBUG: {items_with_location} items with 'location', {items_with_valid_keys} with valid keys")
            print(f"   📂 Loaded {local_count} already-analyzed items from {latest_file.name}")
        except Exception as e:
            print(f"   ⚠️  Could not load local results: {e}")
            already_analyzed_keys = set()
    else:
        print(f"   ℹ️  No previous results found - starting fresh")
    
    # Also check API response for analysis_result field (fallback)
    api_analyzed_keys = set()
    for elem in classified_elements:
        if elem.get("analysis_result") and "NO" not in elem.get("vulnerability_types", []):
            api_analyzed_keys.add(make_elem_key(elem, target_label))

    
    api_count = len(api_analyzed_keys)
    
    # Combine both sources
    already_analyzed_keys.update(api_analyzed_keys)
    
    # Filter out elements with "NO" vulnerability type (not actual vulnerabilities)
    # "NO" means the element was classified as not containing a vulnerability
    no_classifications = [
        elem for elem in classified_elements
        if "NO" in elem.get('vulnerability_types', [])
    ]
    
    print(f"   🔍 Found {len(no_classifications)} elements with 'NO' classification (will be excluded)")
    
    # Filter out:
    # 1. Elements with "NO" vulnerability type (not real vulnerabilities)
    # 2. Elements that are already analyzed (in already_analyzed_keys)
    vuln_elements = [
        elem for elem in classified_elements
        if "NO" not in elem.get('vulnerability_types', [])  # Exclude NO classifications
        and (elem.get('file_path'), str(elem.get('line_num', ''))) not in already_analyzed_keys  # Exclude already analyzed
    ]

    if worker_count > 1:
        distributed: List[Dict[str, Any]] = []
        for idx, elem in enumerate(vuln_elements):
            if idx % worker_count == worker_id:
                distributed.append(elem)
        print(f"   ⚙️  Worker {worker_id + 1}/{worker_count} assigned {len(distributed)} elements")
        vuln_elements = distributed
    
    # Print detailed summary
    print(f"\n{'='*80}")
    print(f"📊 ANALYSIS SUMMARY")
    print(f"{'='*80}")
    print(f"Total elements from API:           {len(classified_elements)}")
    print(f"  - 'NO' classifications:          {len(no_classifications)}")
    print(f"  - Already analyzed (local file): {local_count}")
    print(f"  - Already analyzed (from DB):    {api_count}")
    print(f"  - Total already completed:       {len(already_analyzed_keys)}")
    print(f"\n➡️  Elements to analyze this run:  {len(vuln_elements)}")
    print(f"{'='*80}\n")
    
    if len(vuln_elements) == 0:
        # User requirement: Create empty file if no vulnerabilities
        _write_empty_result_files(project_title)
        
        print("✅ No vulnerabilities to analyze - All work complete!")
        return Command(
            update={
                "classified_elements": [],
                "total_elements": 0,
                "current_stage": "completed",
                "messages": state.get('messages', []) + ["No vulnerabilities to analyze"]
            }
        )
    
    if local_count > 0:
        print(f"ℹ️  Resuming from previous run - skipping {len(already_analyzed_keys)} already-completed items\n")
    
    return Command(
        update={
            "classified_elements": vuln_elements,
            "total_elements": len(vuln_elements),
            "processed_count": state.get('processed_count', 0),
            "analyzed_keys": already_analyzed_keys,  # Pre-populate with already analyzed items
            "failed_elements": [],   # Initialize empty list for failed items
            "current_stage": "fetched",
            "messages": state.get('messages', []) + [
                f"Fetched {len(vuln_elements)} vulnerabilities to analyze"
            ]
        }
    )


def prepare_batch(state: AnalysisState) -> Command:
    """
    Prepare next batch for analysis (excluding items already analyzed or failed)
    """
    classified_elements = state.get('classified_elements', [])
    analyzed_keys = state.get('analyzed_keys', set())
    failed_elements = state.get('failed_elements', [])
    processed_count = state.get('processed_count', 0)
    total_elements = state.get('total_elements', 0)
    target_label = state.get('target_label')
    
    # Filter out items already analyzed OR failed
    failed_keys = {make_elem_key(elem, target_label) for elem in failed_elements}
    
    print(f"\n🔧 PREPARE_BATCH DEBUG:")
    print(f"   - Input: {len(classified_elements)} elements total")
    print(f"   - Successfully analyzed: {len(analyzed_keys)} items")
    print(f"   - Failed (skipping): {len(failed_keys)} items")
    print(f"   - processed_count: {processed_count}/{total_elements}")
    


    unanalyzed_elements = [
        elem for elem in classified_elements
        if make_elem_key(elem, target_label) not in analyzed_keys
        and make_elem_key(elem, target_label) not in failed_keys
    ]
        
    skipped_analyzed = len([
        elem for elem in classified_elements
        if make_elem_key(elem, target_label) in analyzed_keys
    ])
    skipped_failed = len([
        elem for elem in classified_elements
        if make_elem_key(elem, target_label) in failed_keys
    ])
    
    if skipped_analyzed > 0 or skipped_failed > 0:
        print(f"   🔍 Skipped: {skipped_analyzed} analyzed + {skipped_failed} failed = {skipped_analyzed + skipped_failed} total")
    
    if not unanalyzed_elements:
        print(f"   ✅ No more elements to process (all items either analyzed or failed)")
        return Command(
            update={
                "current_batch": [],
                "current_stage": "completed"
            }
        )
    
    # Split into chunks
    chunks = split_elements_into_chunks(unanalyzed_elements)
    
    if not chunks:
        return Command(
            update={
                "current_batch": [],
                "current_stage": "completed"
            }
        )
    
    # Get statistics
    stats = get_chunk_stats(chunks)
    print(f"\n📦 Chunking stats:")
    print(f"   - Total chunks: {stats['num_chunks']}")
    print(f"   - Elements per chunk: {stats['min_chunk_size']}-{stats['max_chunk_size']} (avg: {stats['avg_chunk_size']:.1f})")
    print(f"   - JSON length per chunk: {stats['min_json_length']}-{stats['max_json_length']} (avg: {stats['avg_json_length']:.0f})")
    
    # Take first chunk as current batch
    current_batch = chunks[0]
    
    processed_count = state.get('processed_count', 0)
    total_elements = state.get('total_elements', 0)
    
    print(f"\n🔄 Analyzing batch: {processed_count + len(current_batch)}/{total_elements} ({(processed_count + len(current_batch)) / total_elements * 100:.1f}%)")
    
    print(f"\n🔧 PREPARE_BATCH OUTPUT:")
    print(f"   - current_batch: {len(current_batch)} elements")
    print(f"   - unanalyzed remaining: {len(unanalyzed_elements) - len(current_batch)} elements")
    
    # ✅ Keep original classified_elements, don't modify it
    # The analyzed_keys set will handle filtering on next iteration
    return Command(
        update={
            "current_batch": current_batch,
            # classified_elements stays the same - filtering happens via analyzed_keys
            "current_stage": "prepared"
        }
    )


def _build_history_summary_message(
    analyzed_batch: List[Dict[str, Any]],
    tool_call_count: int,
    max_items: int = 3,
) -> Optional[AIMessage]:
    if not analyzed_batch:
        return None

    lines: List[str] = []
    for item in analyzed_batch[:max_items]:
        title = item.get("vulnerability_title", "Unknown title")
        severity = item.get("severity", "Unknown severity")
        location = item.get("location") or {}
        file_path = ""
        if isinstance(location, dict):
            file_path = location.get("file_path", "")

        entry = f"- [{severity}] {title}"
        if file_path:
            entry += f" ({file_path})"
        lines.append(entry)

    remaining = len(analyzed_batch) - min(len(analyzed_batch), max_items)
    if remaining > 0:
        lines.append(f"... and {remaining} more findings")

    lines.append(f"Tool calls used: {tool_call_count}")

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    content = f"[Batch Summary {timestamp}]\n" + "\n".join(lines)
    return AIMessage(content=content)


def _coerce_system_history(history: Any, keep_last: int = 4) -> List[AIMessage]:
    """
    Convert stored history into a list of assistant(AI) summary messages.
    (예전 system-role dict도 최대한 살려서 가져오도록 backward compatible)
    """
    coerced: List[AIMessage] = []
    if not isinstance(history, list):
        return coerced

    for item in history:
        # 이미 AIMessage면 그대로 살림
        if isinstance(item, AIMessage):
            coerced.append(AIMessage(content=str(item.content)))

        # 예전 포맷: {"role": "system", "content": "..."} 같은 dict
        elif isinstance(item, dict) and item.get("role") in ("assistant", "system"):
            coerced.append(AIMessage(content=str(item.get("content", ""))))

        # 혹시 문자열만 있는 경우도 안전하게 처리
        elif isinstance(item, str):
            coerced.append(AIMessage(content=item))

    if keep_last and len(coerced) > keep_last:
        coerced = coerced[-keep_last:]
    return coerced


async def analyze_batch(state: AnalysisState, llm, mcp_client, provider: str = "unknown") -> Command:
    """
    Perform deep vulnerability analysis for current batch using LLM + MCP
    
    Args:
        state: Current state
        llm: Language model instance
        mcp_client: MCP client for tools
        provider: LLM provider (google/groq/openai)
    """
    # Initialize logger at the start so it's available everywhere
    logger = get_logger()
    
    current_batch = state.get('current_batch', [])
    
    if not current_batch:
        return Command(
            update={
                "analyzed_batch": [],
                "current_stage": "analyzed"
            }
        )
    
    processed_count = state.get('processed_count', 0)
    total_elements = state.get('total_elements', 0)
    
    print(f"\n🔬 Analyzing batch ({len(current_batch)} elements)...")
    print(f"   Progress: {processed_count}/{total_elements} ({processed_count / total_elements * 100:.1f}%)")
    max_tool_calls = AGENT_MAX_TOOL_CALLS

    short_instruction = _build_system_prompt(state, max_tool_calls)

    # Prepare user message with MANDATORY MCP usage
    batch_json = json.dumps(current_batch, ensure_ascii=False, indent=2)
    target_label = state.get("target_label")
    target_hint = ""
    if target_label:
        target_hint = f"\nFocus strictly on {target_label} behaviors and discard unrelated findings.\n"
    user_message = f"""Perform deep taint analysis on the following classified vulnerability elements.{target_hint}

Tool parameters guidelines:

- If any tool returns "output truncated" or "max_answer_chars exceeded":
    You MUST take action:
    1. Make pattern more specific and search again
    2. OR: Increase max_answer_chars
    3. OR: Split search by directory (paths_include_glob)
    4. OR: Split search by file type
    5. Retry until you get COMPLETE results

{batch_json}

Each vulnerability object MUST contain:
- ACTUAL CODE SNIPPETS from MCP tool results
- file paths and line numbers discovered via MCP tools
- Concrete POC using actual API endpoints
"""
    
    # Bind MCP tools to LLM
    llm_with_tools = llm
    tools = []
    if mcp_client:
        try:
            print(f"\n{'='*80}")
            print(f"🔧 MCP TOOLS BINDING")
            print(f"{'='*80}")
            
            # Get MCP tools (already in async context, no need for asyncio.run)
            all_tools = await mcp_client.get_tools()
            print("🔍 Retrieved MCP tools:")
            for i, tool in enumerate(all_tools, 1):
                print(f"  {i}. {tool.name}")
            
            # ============================================================
            # TOOL FILTERING: Control which tools the agent can use
            # ============================================================
            # Option 1: ALLOW_LIST - Only allow specific tools (recommended for focused analysis)
            ALLOWED_TOOLS = [
                "list_dir",
                "read_file",
                "search_for_pattern",
                "find_symbol",
                "get_symbols_overview",
                # "get_file_structure",
                # "search_symbol_references",
                # "get_declaration_location",
                # Add more tools as needed
            ]
            
            # Option 2: BLOCK_LIST - Block specific tools (use this if you want most tools)
            BLOCKED_TOOLS = [
                # "expensive_tool",
                # "slow_tool",
                # Add tools you want to block
                "activate_project",
                "replace_symbol_body", "insert_after_symbol", "insert_before_symbol", "write_memory", "read_memory", "list_memories", "delete_memory", "execute_shell_command", "switch_modes", "get_current_config", "check_onboarding_performed", "onboarding", "think_about_collected_information", "think_about_task_adherence", "think_about_whether_you_are_done", "prepare_for_new_conversation"
            ]
            # ['read_file', 'create_text_file', 'list_dir', 'find_file', 'replace_regex', 'search_for_pattern', 'get_symbols_overview', 'find_symbol', 'find_referencing_symbols', 'replace_symbol_body', 'insert_after_symbol', 'insert_before_symbol', 'write_memory', 'read_memory', 'list_memories', 'delete_memory', 'execute_shell_command', 'activate_project', 'switch_modes', 'get_current_config', 'check_onboarding_performed', 'onboarding', 'think_about_collected_information', 'think_about_task_adherence', 'think_about_whether_you_are_done', 'prepare_for_new_conversation']
            # Apply filtering
            # Uncomment ONE of the following:
            
            # Use ALLOW_LIST (recommended - only specified tools allowed)
            # tools = [tool for tool in all_tools if tool.name in ALLOWED_TOOLS]
            
            # Use BLOCK_LIST (allows all except blocked ones)
            tools = [tool for tool in all_tools if tool.name not in BLOCKED_TOOLS]
            
            # No filtering (use all tools)
            # tools = all_tools
            
        #     if tools:
        #         llm_with_tools = llm.bind_tools(tools)
        #         print(f"✅ Successfully bound {len(tools)} MCP tools to LLM")
        #         print(f"   (Filtered from {len(all_tools)} total available tools)")
        #         print(f"\nAllowed tools:")
        #         for i, tool in enumerate(tools, 1):
        #             print(f"  {i}. {tool.name}")
                
        #         if len(all_tools) > len(tools):
        #             blocked = [t.name for t in all_tools if t not in tools]
        #             print(f"\n🚫 Blocked tools ({len(blocked)}):")
        #             for tool_name in blocked[:5]:
        #                 print(f"  • {tool_name}")
        #             # if len(blocked) > 5:
        #                 # print(f"  ... and {len(blocked) - 5} more")
        #     else:
        #         print(f"⚠️  No MCP tools available after filtering")
        #     print(f"{'='*80}\n")
        except Exception as e:
            print(f"\n{'='*80}")
            print(f"❌ MCP TOOLS BINDING FAILED")
            print(f"{'='*80}")
            print(f"Error: {e}")
            print(f"Error type: {type(e).__name__}")
            import traceback
            print(f"\nFull traceback:")
            traceback.print_exc()
            print(f"{'='*80}\n")
            tools = []
            # Continue without MCP tools

    # Invoke LLM with rate limiting using ReAct Agent
    result_text = ""
    try:
        # Use provided provider (no guessing!)
        rate_limiter = get_rate_limiter(provider)
        
        print(f"\n{'='*80}")
        print(f"🤖 CREATING REACT AGENT")
        print(f"{'='*80}")
        print(f"Model: {llm.model_name if hasattr(llm, 'model_name') else 'Unknown'}")
        print(f"Temperature: {llm.temperature if hasattr(llm, 'temperature') else 'Unknown'}")
        print(f"Tools available: {len(tools)}")
        print(f"\nSystem prompt length: {len(short_instruction)} chars")
        print(f"User message length: {len(user_message)} chars")
        print(f"\nUser message preview (first 500 chars):")
        print(user_message[:500])
        print(f"{'='*80}\n")
        
        # Create ReAct Agent - it handles tool calling loop automatically
        # IMPORTANT: Use state_modifier to replace long system prompt with short instruction
        from langgraph.prebuilt.chat_agent_executor import create_react_agent
        
        # Short system instruction with CLEAR stopping condition AND DETAILED SCHEMA
        # Note: Using format() instead of f-string to avoid nested quote issues

        
        agent = create_react_agent(llm, tools)
        
        print(f"✅ ReAct Agent created")
        print(f"   - Model: {llm.model_name if hasattr(llm, 'model_name') else 'Unknown'}")
        print(f"   - Tools: {len(tools)}")
        print(f"   - Recursion limit: 25 iterations\n")
        
        previous_history = state.get('agent_message_history', [])

        history_messages: List[BaseMessage] = []
        if isinstance(previous_history, list):
            for msg in previous_history:
                if isinstance(msg, SystemMessage):
                    history_messages.append(SystemMessage(content=str(msg.content)))
                elif isinstance(msg, HumanMessage):
                    history_messages.append(HumanMessage(content=str(msg.content)))
                elif isinstance(msg, AIMessage):
                    history_messages.append(AIMessage(content=str(msg.content)))
                elif isinstance(msg, dict):
                    role = msg.get("role")
                    content = str(msg.get("content", ""))
                    if role == "system":
                        history_messages.append(SystemMessage(content=content))
                    elif role in ("human", "user"):
                        history_messages.append(HumanMessage(content=content))
                    elif role in ("assistant", "ai"):
                        history_messages.append(AIMessage(content=content))
            if len(history_messages) > 5:
                history_messages = history_messages[-5:]

        if history_messages:
            print(f"\nReusing {len(history_messages)} summary messages from previous batches")
            input_messages: List[BaseMessage] = [SystemMessage(content=short_instruction)]
            input_messages.extend(history_messages)
            input_messages.append(HumanMessage(content=user_message))
        else:
            # First batch or no usable history - start fresh
            input_messages = [
                SystemMessage(content=short_instruction),
                HumanMessage(content=user_message)
            ]
        
        def estimate_message_tokens(messages) -> int:
            total_chars = 0
            for msg in messages:
                if isinstance(msg, dict):
                    total_chars += len(str(msg.get("role", "")))
                    total_chars += len(str(msg.get("content", "")))
                    tool_calls = msg.get("tool_calls")
                    if tool_calls:
                        total_chars += len(str(tool_calls))
                else:
                    if hasattr(msg, "content"):
                        total_chars += len(str(msg.content))
                    else:
                        total_chars += len(str(msg))
                    if hasattr(msg, "tool_calls") and getattr(msg, "tool_calls"):
                        total_chars += len(str(msg.tool_calls))
            return total_chars // 4
        
        max_prompt_tokens = max(512, ANALYSIS_CONTEXT_WINDOW - ANALYSIS_RESPONSE_TOKEN_RESERVE)
        prompt_tokens = estimate_message_tokens(input_messages)
        
        if prompt_tokens > max_prompt_tokens and len(history_messages) > 1:
            print(
                f"\nPrompt estimate {prompt_tokens} exceeds budget {max_prompt_tokens}. "
                "Trimming history to the most recent summary message."
            )
            history_messages = history_messages[-1:]
            input_messages = [SystemMessage(content=short_instruction)]
            input_messages.extend(history_messages)
            input_messages.append(HumanMessage(content=user_message))
            prompt_tokens = estimate_message_tokens(input_messages)
        
        if prompt_tokens > max_prompt_tokens:
            print(
                f"\nPrompt still over budget ({prompt_tokens} > {max_prompt_tokens}). Using minimal prompt."
            )
            if input_messages:
                system_message = input_messages[0]
                if not isinstance(system_message, SystemMessage):
                    system_message = SystemMessage(content=short_instruction)
                keep_count = min(5, max(0, len(input_messages) - 1))
                keep = input_messages[-keep_count:] if keep_count else []
                input_messages = [system_message] + keep
                prompt_tokens = estimate_message_tokens(input_messages)
        
        estimated_tokens = prompt_tokens + ANALYSIS_RESPONSE_TOKEN_RESERVE
        
        print(f"\n⏱️  Rate Limiter Stats ({provider.upper()}):")
        stats = rate_limiter.get_stats()
        print(f"   RPM: {stats['rpm']['current']}/{stats['rpm']['limit']}")
        if stats['tpm']['limit']:
            print(f"   TPM: {stats['tpm']['current']}/{stats['tpm']['limit']}")
        print(f"   Estimated prompt tokens: {prompt_tokens}")
        print(f"   Response reserve: {ANALYSIS_RESPONSE_TOKEN_RESERVE}")
        print(f"   Context window limit: {ANALYSIS_CONTEXT_WINDOW}")
        print(f"   Estimated total tokens: {estimated_tokens}")
        
        # Acquire rate limit permission now that message payload is finalized
        await rate_limiter.acquire(estimated_tokens=estimated_tokens)
        
        if logger:
            model_name = llm.model_name if hasattr(llm, 'model_name') else 'Unknown'
            logger.log_llm_request(model_name, input_messages, len(tools))
        
        print(f"   -> Sending {len(input_messages)} messages to agent")
        
        # Invoke agent with increased recursion limit and error handling
        print(f"\n⚙️  Agent Configuration:")
        print(f"   Recursion Limit: {AGENT_RECURSION_LIMIT} (set via AGENT_RECURSION_LIMIT in .env)")
        print(f"   Max Tool Calls: {AGENT_MAX_TOOL_CALLS} (set via AGENT_MAX_TOOL_CALLS in .env)")
        
        try:
            agent_result = await agent.ainvoke(
                {"messages": input_messages},
                config={
                    "recursion_limit": AGENT_RECURSION_LIMIT,  # From .env
                }
            )
        except Exception as e:
            if "recursion limit" in str(e).lower():
                print(f"\n⚠️  Agent hit recursion limit - this means it couldn't decide when to stop")
                print(f"   This usually happens when:")
                print(f"   1. The task is too complex for the current batch")
                print(f"   2. Tools are returning truncated results")
                print(f"   3. Agent is stuck in a loop calling the same tools")
                print(f"\n   💡 Returning empty result for this batch to continue...")
                
                # Return empty result to allow workflow to continue
                return Command(
                    update={
                        "analyzed_batch": [],
                        "processed_count": processed_count + len(current_batch),
                        "current_stage": "analyzed",
                        "messages": state.get('messages', []) + [
                            f"Batch skipped due to recursion limit: {str(e)}"
                        ]
                    }
                )
            else:
                raise  # Re-raise other errors
        
        # Extract final response from agent result
        final_messages = agent_result.get("messages", [])
        if not final_messages:
            raise ValueError("Agent returned no messages")
        
        # ============================================================================
        # 🔍 DEBUG: Print and log ALL intermediate messages
        # ============================================================================
        print(f"\n{'='*80}")
        print(f"🔍 REACT AGENT MESSAGE HISTORY ({len(final_messages)} messages)")
        print(f"{'='*80}\n")
        
        tool_call_count = 0
        invalid_tool_calls_all = []
        for idx, msg in enumerate(final_messages, 1):
            msg_type = type(msg).__name__
            
            # System/Human messages
            if msg_type in ['SystemMessage', 'HumanMessage']:
                role = 'System' if msg_type == 'SystemMessage' else 'Human'
                content_preview = msg.content[:200] if hasattr(msg, 'content') else str(msg)[:200]
                
                print(f"Message #{idx} [{role}]:")
                print(f"  Length: {len(msg.content) if hasattr(msg, 'content') else len(str(msg))} chars")
                print(f"  Preview: {content_preview}...")
                
                # Log to file (use proper signature)
                # if logger:
                #     logger.log_llm_request(
                #         model=llm.model_name if hasattr(llm, 'model_name') else 'Unknown',
                #         messages=[{"role": role.lower(), "content": msg.content if hasattr(msg, 'content') else str(msg)}],
                #         tools_count=0
                #     )
            
            # AI messages (with or without tool calls)
            elif msg_type == 'AIMessage':
                has_tool_calls = hasattr(msg, 'tool_calls') and msg.tool_calls
                content_length = len(msg.content) if hasattr(msg, 'content') else 0

                # 🆕 invalid_tool_calls 추출
                additional = getattr(msg, "additional_kwargs", {}) or {}
                invalid_calls = additional.get("invalid_tool_calls", []) or []
                if invalid_calls:
                    print(f"\nMessage #{idx} [AI - Invalid Tool Calls]: {len(invalid_calls)}")
                    for ic in invalid_calls:
                        print(f"  🔴 Tool: {ic.get('name')}")
                        print(f"  🔸 Args: {ic.get('args')[:200]}...")
                        print(f"  ⚠️ Error: {ic.get('error')}")
                    invalid_tool_calls_all.extend(invalid_calls)

                if has_tool_calls:
                    print(f"\nMessage #{idx} [AI - Tool Calls]:")
                    print(f"  Content length: {content_length} chars")
                    print(f"  Tool calls: {len(msg.tool_calls)}")
                    
                    for i, tool_call in enumerate(msg.tool_calls, 1):
                        tool_name = tool_call.get('name', 'Unknown')
                        tool_args = tool_call.get('args', {})
                        tool_id = tool_call.get('id', 'Unknown')
                        
                        tool_call_count += 1
                        
                        print(f"\n  🔧 Tool Call #{i}:")
                        print(f"     Name: {tool_name}")
                        print(f"     ID: {tool_id}")
                        print(f"     Args: {json.dumps(tool_args, indent=6, ensure_ascii=False)}")
                        
                        # Log MCP request
                        if logger:
                            logger.log_mcp_request(tool_name, tool_args)
                        
                        print(f"\n  {'='*76}")
                    
                    # Log AI response with tool calls
                    if logger:
                        logger.log_llm_response(msg.content if hasattr(msg, 'content') else "", full_response=msg)
                
                else:
                    # Regular AI response without tool calls
                    content_preview = (msg.content[:500] if hasattr(msg, 'content') else str(msg)[:500])
                    
                    print(f"\nMessage #{idx} [AI - Response]:")
                    print(f"  Length: {content_length} chars")
                    print(f"  Preview: {content_preview}")
                    if content_length > 500:
                        print(f"  ... (truncated, total {content_length} chars)")
                    
                    # Log AI response
                    if logger:
                        logger.log_llm_response(msg.content if hasattr(msg, 'content') else str(msg), full_response=msg)
            
            # Tool messages (tool execution results)
            elif msg_type == 'ToolMessage':
                tool_name = msg.name if hasattr(msg, 'name') else 'Unknown'
                tool_id = msg.tool_call_id if hasattr(msg, 'tool_call_id') else 'Unknown'
                content_length = len(msg.content) if hasattr(msg, 'content') else len(str(msg))
                content_preview = (msg.content[:300] if hasattr(msg, 'content') else str(msg)[:300])
                
                print(f"\nMessage #{idx} [Tool Result]:")
                print(f"  Tool: {tool_name}")
                print(f"  Call ID: {tool_id}")
                print(f"  Result length: {content_length} chars")
                print(f"  Preview: {content_preview}")
                if content_length > 300:
                    print(f"  ... (truncated, total {content_length} chars)")
                
                # Log tool response (use proper signature)
                if logger:
                    logger.log_mcp_response(
                        tool_name=tool_name,
                        output_data=msg.content if hasattr(msg, 'content') else str(msg)
                    )
            
            else:
                # Unknown message type
                print(f"\nMessage #{idx} [Unknown: {msg_type}]:")
                print(f"  Content: {str(msg)[:200]}...")
            
            print()  # Blank line between messages
        
        print(f"{'='*80}\n")
        if invalid_tool_calls_all:
            last_msg = final_messages[-1]
            last_content = getattr(last_msg, "content", "") or ""
            has_pending_tools = hasattr(last_msg, "tool_calls") and last_msg.tool_calls

            # 마지막 메시지가 내용 없이 invalid_tool_calls만 남은 경우
            if not last_content.strip() and not has_pending_tools:
                print("⚠️  Agent produced only invalid tool calls (no usable response).")
                print("    Feeding error information back to the agent and retrying once...\n")

                from langchain_core.messages import ToolMessage

                error_tool_messages = []
                for ic in invalid_tool_calls_all:
                    error_text = (
                        f"Your previous call to tool `{ic.get('name')}` failed.\n"
                        f"Arguments: {ic.get('args')}\n"
                        f"Error: {ic.get('error')}\n\n"
                        "Please fix the arguments and call the tool again to continue the analysis."
                    )
                    error_tool_messages.append(
                        ToolMessage(
                            content=error_text,
                            name=ic.get("name", "unknown"),
                            tool_call_id=ic.get("id", "invalid"),
                        )
                    )

                # 이전 input + 이번 대화 + 에러 ToolMessage를 모두 넣고 한 번 더 호출
                retry_messages = input_messages + final_messages + error_tool_messages

                retry_prompt_tokens = estimate_message_tokens(retry_messages)
                retry_estimated_tokens = retry_prompt_tokens + ANALYSIS_RESPONSE_TOKEN_RESERVE
                await rate_limiter.acquire(estimated_tokens=retry_estimated_tokens)

                agent_result = await agent.ainvoke(
                    {"messages": retry_messages},
                    config={"recursion_limit": AGENT_RECURSION_LIMIT},
                )
                final_messages = agent_result.get("messages", [])

                print("\n♻️  Retried agent after invalid tool calls.")
                print(f"    New total messages: {len(final_messages)}")
                print(f"{'='*80}\n")

        
        # Get the last AI message as final response
        final_response = final_messages[-1]
        if hasattr(final_response, "tool_calls") and final_response.tool_calls:
            pending_msg = "LLM output ended with pending tool calls and no final response"
            print(f"   ⚠️  {pending_msg}")
            return Command(
                update={
                    "analyzed_batch": [],
                    "current_stage": "analyzed",
                    "messages": state.get('messages', []) + [pending_msg]
                }
            )
        
        result_text = final_response.content if hasattr(final_response, 'content') else str(final_response)

        mcp_tool_count = sum(
            len(getattr(m, "tool_calls", []) or [])
            for m in final_messages
            if type(m).__name__ == "AIMessage"
        )
        mcp_used = mcp_tool_count > 0 or bool(invalid_tool_calls_all)

                
        print(f"\n{'='*80}")
        print(f"✅ REACT AGENT COMPLETED")
        print(f"{'='*80}")
        print(f"Total messages exchanged: {len(final_messages)}")
        print(f"Total tool calls made: {tool_call_count}")
        print(f"Final response length: {len(result_text)} chars")
        print(f"\nResponse preview (first 1000 chars):")
        print(result_text[:1000])
        if len(result_text) > 1000:
            print(f"... (truncated, total {len(result_text)} chars)")
        print(f"{'='*80}\n")
        
        if not mcp_used:
            print(f"\n{'='*80}")
            print(f"⚠️  WARNING: AGENT DID NOT USE ANY MCP TOOLS!")
            print(f"{'='*80}")
            print(f"This means the analysis is based on ASSUMPTIONS, not actual code.")
            print(f"The vulnerability analysis may be INACCURATE or INCOMPLETE.")
            print(f"\nPossible reasons:")
            print(f"1. MCP tools not properly bound ({len(tools)} tools available)")
            print(f"2. LLM chose to skip tool usage (provider limitation?)")
            print(f"3. Provider: {provider} - may not support tool calling well")
            print(f"\nProceeding anyway, but results will be marked as LOW CONFIDENCE.")
            print(f"Consider re-running with OpenAI GPT-4o for better tool support.")
            print(f"{'='*80}\n")
        else:
            print(f"\n{'='*80}")
            print(f"✅ GOOD: Agent used {mcp_tool_count} MCP tool calls")
            print(f"{'='*80}")
            print(f"Analysis should be based on actual code evidence.")
            print(f"Confidence level: HIGH")
            print(f"{'='*80}\n")
        
        # Store metrics for later analysis
        analysis_metadata = {
            "mcp_used": mcp_used,
            "mcp_tool_count": mcp_tool_count,
            "provider": provider,
            "tools_available": len(tools),
            "batch_size": len(current_batch),
            "total_messages": len(final_messages)
        }
        
        # Pre-process response text before JSON parsing
        # 1. Remove <think>...</think> tags if present
        if "</think>" in result_text:
            print(f"   🔍 Detected <think> tags, removing thinking process...")
            # Find the position after </think>
            think_end = result_text.rfind("</think>")
            if think_end != -1:
                result_text = result_text[think_end + len("</think>"):]
                print(f"   ✅ Removed thinking section, remaining: {len(result_text)} chars")
        
        # 2. Strip whitespace
        result_text = result_text.strip()
        
        if not result_text:
            warn_msg = "LLM returned empty response (no content) despite completion"
            print(f"   ⚠️  {warn_msg}")

            failed_elements = state.get("failed_elements", [])
            failed_elements.extend(current_batch)

            return Command(
                update={
                    "analyzed_batch": [],
                    "failed_elements": failed_elements,
                    "current_stage": "analyzed",
                    "messages": state.get('messages', []) + [warn_msg]
                }
            )
        
        # 3. Extract JSON from markdown code blocks
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0].strip()
        
        print(f"\n📋 Final text for JSON parsing ({len(result_text)} chars):")
        print(f"   First 200 chars: {result_text[:200]}")
        if len(result_text) > 200:
            print(f"   Last 200 chars: ...{result_text[-200:]}")
        
        # Parse JSON response
        try:
            analyzed_batch = json.loads(result_text)
        except Exception as exc:
            print(f"   ❌ JSON parsing failed: {exc}")
            try:
                analyzed_batch = json_repair(result_text)
                print(f"   ✅ Recovered JSON after repair attempt")
            except Exception as repair_exc:
                print(f"   ❌ JSON repair also failed: {repair_exc}")
                analyzed_batch = []
        
        # If LLM returned empty array, warn but continue
        if not analyzed_batch:
            print(f"   ⚠️  LLM returned empty analysis (0 vulnerabilities)")
            print(f"   📊 Current batch had {len(current_batch)} elements to analyze")
            print(f"   ➡️  Skipping this batch and moving to next...")
        else:
            print(f"   ✅ Analyzed {len(analyzed_batch)} vulnerabilities")

        if isinstance(analyzed_batch, dict):
            # 예: {"vulnerabilities": [...]} 형태면 안쪽 리스트를 꺼내기
            if "vulnerabilities" in analyzed_batch:
                analyzed_batch = analyzed_batch["vulnerabilities"]
            else:
                analyzed_batch = [analyzed_batch]
        elif not isinstance(analyzed_batch, list):
            analyzed_batch = [analyzed_batch]
        
        # Ensure every vulnerability includes a code_fix_patch field (LLM should supply it)
        enriched_batch: List[Dict[str, Any]] = []
        for vuln in analyzed_batch:
            if not isinstance(vuln, dict):
                continue
            if "code_fix_patch" not in vuln or not isinstance(vuln.get("code_fix_patch"), dict):
                location = vuln.get('location') or {}
                vuln["code_fix_patch"] = {
                    "target_file": location.get('file_path', ''),
                    "line_range": location.get('line_number', ''),
                    "original_snippet": "",
                    "modified_snippet": "",
                    "notes": "LLM did not include code_fix_patch.",
                }
            enriched_batch.append(vuln)

        analyzed_batch = enriched_batch

        # Update all_analyzed list
        all_analyzed = state.get('all_analyzed', [])
        all_analyzed.extend(analyzed_batch)
        
        summary_history = _coerce_system_history(state.get('agent_message_history', []))
        summary_message = _build_history_summary_message(analyzed_batch, tool_call_count)
        if summary_message:
            summary_history.append(summary_message)
            if len(summary_history) > 5:
                summary_history = summary_history[-5:]

        return Command(
            update={
                "analyzed_batch": analyzed_batch,
                "all_analyzed": all_analyzed,
                "processed_count": processed_count + len(current_batch),
                "current_stage": "analyzed",
                "agent_message_history": summary_history
            }
        )
    
    except json.JSONDecodeError as e:
        error_msg = f"Failed to parse LLM response as JSON: {e}"
        print(f"\n{'='*80}")
        print(f"   ❌ {error_msg}")
        print(f"{'='*80}")
        
        if 'result_text' in locals():
            print(f"\n📄 FULL RESPONSE TEXT ({len(result_text)} chars):")
            print(f"{'='*80}")
            print(result_text)
            print(f"{'='*80}\n")
            
            # Log to file for debugging (logger is always defined at this point)
            if logger:  # Should always be True since logger = get_logger() above
                logger._write_log({
                    "type": "JSON_PARSE_ERROR",
                    "timestamp": datetime.now().isoformat(),
                    "error": str(e),
                    "response_length": len(result_text),
                    "full_response": result_text
                })
        else:
            print(f"   ⚠️  result_text variable not available (response might be empty)")
            
            if logger:
                logger._write_log({
                    "type": "JSON_PARSE_ERROR",
                    "timestamp": datetime.now().isoformat(),
                    "error": str(e),
                    "note": "result_text not available in locals"
                })
        
        return Command(
            update={
                "analyzed_batch": [],
                "processed_count": processed_count + len(current_batch),
                "current_stage": "analyzed",
                "messages": state.get('messages', []) + [
                    f"Failed to parse batch: {str(e)}"
                ]
            }
        )
    

    except Exception as e:
        print(f"   ❌ Analysis error: {e}")
        print(f"   Error type: {type(e).__name__}")
        
        # ✅ Print full traceback
        import traceback
        print("\n📍 FULL ERROR TRACEBACK:")
        print("="*80)
        traceback.print_exc()
        print("="*80)
        
        # ✅ Print local variables if available
        import sys
        exc_type, exc_value, exc_traceback = sys.exc_info()
        if exc_traceback:
            frame = exc_traceback.tb_frame
            print("\n📍 LOCAL VARIABLES AT ERROR:")
            print("="*80)
            for var_name, var_value in list(frame.f_locals.items())[:10]:  # First 10 vars
                print(f"  {var_name}: {type(var_value).__name__} = {str(var_value)[:100]}...")
            print("="*80)
        
        # ✅ Log to file
        if logger:
            logger.log_error(
                function="analyze_batch",
                error=e,
                traceback_str=traceback.format_exc()
            )
        
        failed_elements = state.get('failed_elements', [])
        if current_batch:
            failed_elements = list(failed_elements) + current_batch
            print(f"   ⚠️  Added {len(current_batch)} items to failed queue due to error (total failed: {len(failed_elements)})")

        return Command(
            update={
                "analyzed_batch": [],
                "processed_count": processed_count + len(current_batch),
                "current_stage": "analyzed",
                "failed_elements": failed_elements,
                "messages": state.get('messages', []) + [
                    f"Analysis error: {str(e)}"
                ]
            }
        )


def save_results(state: AnalysisState) -> Command:
    """
    Save analysis results to file and update backend database
    """
    analyzed_batch = state.get('analyzed_batch', [])
    current_batch = state.get('current_batch', [])

    # Track items based on success/failure
    analyzed_keys = state.get('analyzed_keys', set())
    failed_elements = state.get('failed_elements', [])

    target_label = state.get('target_label')

    original_results = list(analyzed_batch or [])
    dismissed_results = [
        result for result in original_results
        if result.get("vulnerability_title") == "NO" and result.get("cwe") == "NO"
    ]
    analyzed_batch = [
        result for result in original_results
        if not (result.get("vulnerability_title") == "NO" and result.get("cwe") == "NO")
    ]

    if not original_results:
        # Analysis failed - add to failed_elements for later retry
        print("   ⏭️  No analysis results to save (likely JSON parsing error)")
        failed_elements.extend(current_batch)
        print(f"   📍 Added {len(current_batch)} failed items to retry queue (total failed: {len(failed_elements)})")
        return Command(
            update={
                "failed_elements": failed_elements,
                "current_stage": "saved"
            }
        )

    # Success case - add to analyzed_keys
    for vuln in current_batch:
        analyzed_keys.add(make_elem_key(vuln, target_label))

    print(
        f"\n💾 Processing {len(original_results)} analysis responses "
        f"(confirmed: {len(analyzed_batch)}, dismissed: {len(dismissed_results)})"
    )

    # Save to JSON file

    project_title = state.get('project_title', 'unknown')
    output_dir = Path("analysis_results")
    output_dir.mkdir(exist_ok=True)

    # Create filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = output_dir / f"{project_title}_{timestamp}_analysis.json"

    # Also create/update a "latest" file without timestamp
    latest_file = output_dir / f"{project_title}_latest.json"

    # Load existing results if any from latest file
    existing_results = []
    if latest_file.exists():
        try:
            with FILE_IO_LOCK:
                with open(latest_file, 'r', encoding='utf-8') as f:
                    existing_results = json.load(f)  # ✅ 정석
        except Exception as e:
            print(f"   ⚠️ Failed to load existing latest file: {e}")
            existing_results = []

    annotated_batch = []
    for analysis_result in analyzed_batch:
        annotated = dict(analysis_result)
        if target_label:
            annotated["analysis_target_label"] = target_label
        annotated_batch.append(annotated)

    if annotated_batch:
        # Append new results to cumulative file
        existing_results.extend(annotated_batch)

        # Save timestamped file with ONLY current batch (not cumulative)
        with FILE_IO_LOCK:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(annotated_batch, f, ensure_ascii=False, indent=2)

            # Save latest file with ALL results (cumulative)
            with open(latest_file, 'w', encoding='utf-8') as f:
                json.dump(existing_results, f, ensure_ascii=False, indent=2)

        print(f"   ✅ Saved to {output_file}")
        print(f"   ✅ Updated {latest_file}")
    else:
        print("   📨 No confirmed vulnerabilities to persist for this batch.")

    # Update backend database
    backend_message = ""
    if not annotated_batch:
        backend_message = "No confirmed vulnerabilities to update"
    elif _is_json_classification_mode(state):
        print("   ⚠️ Skipping backend update (JSON input mode)")
        backend_message = "Skipped backend update in JSON mode"
    else:
        print(f"\n📤 Updating backend database with {len(analyzed_batch)} analysis results...")

        # Combine original vulnerability data with analysis results
        update_data = []
        for orig_vuln, analysis_result in zip(current_batch, analyzed_batch):
            # Create update payload combining original data with analysis
            update_item = {
                "file_path": orig_vuln.get("file_path"),
                "line_num": orig_vuln.get("line_num"),
                "code_snippet": orig_vuln.get("code_snippet"),
                "vulnerability_types": orig_vuln.get("vulnerability_types", []),
                "analysis_result": analysis_result  # Add the detailed analysis
            }
            update_data.append(update_item)

        try:
            from ...utils.api_client import batch_update_vulnerabilities
            result = asyncio.run(batch_update_vulnerabilities(project_title, update_data))

            if "error" in result:
                print(f"   ⚠️ Backend update error: {result['error']}")
                backend_message = f"Backend update error: {result['error']}"
            else:
                print(f"   ✅ Backend updated successfully")
                backend_message = f"Updated backend database with {len(analyzed_batch)} results"
        except Exception as e:
            print(f"   ⚠️ Failed to update backend: {e}")
            backend_message = f"Backend update failed: {e}"
            # Continue even if backend update fails - local files are saved

    print(f"   📍 Tracked {len(current_batch)} successfully analyzed items (total tracked: {len(analyzed_keys)})")
    message_list = []
    if annotated_batch:
        message_list.append(f"Saved {len(analyzed_batch)} results to {output_file}")
    if dismissed_results:
        message_list.append(f"Marked {len(dismissed_results)} items as non-vulnerable")
    if backend_message:
        message_list.append(backend_message)

    return Command(
        update={
            "analyzed_keys": analyzed_keys,
            "current_stage": "saved",
            "messages": state.get('messages', []) + message_list
        }
    )




def check_completion(state: AnalysisState) -> Command:
    """
    Check if all elements have been analyzed
    """
    if not isinstance(state, dict):
        print(f"\n⚠️  check_completion received unexpected state type: {type(state).__name__} -> {state!r}")
        if isinstance(state, str) and state.lower() == "done":
            return Command(update={"current_stage": "completed"})
        return Command(update={})
    
    classified_elements = state.get('classified_elements', [])
    analyzed_keys = state.get('analyzed_keys', set())
    failed_elements = state.get('failed_elements', [])
    processed_count = state.get('processed_count', 0)
    total_elements = state.get('total_elements', 0)
    all_analyzed = state.get('all_analyzed', [])
    failed_retry_count = state.get('failed_retry_count', 0)
    max_failed_retries = MAX_FAILED_RETRIES
    target_label = state.get('target_label')
    
    print(f"\n🔍 CHECK_COMPLETION DEBUG:")
    print(f"   - classified_elements total: {len(classified_elements)}")
    print(f"   - successfully analyzed: {len(analyzed_keys)}")
    print(f"   - failed (will retry): {len(failed_elements)}")
    print(f"   - processed_count: {processed_count}/{total_elements}")
    print(f"   - all_analyzed count: {len(all_analyzed)}")
    
    # Check if we still have unanalyzed elements
    # IMPORTANT: Normalize line_num to string for key comparison!
    failed_keys = {make_elem_key(elem, target_label) for elem in failed_elements}

    
    unanalyzed_count = len([
        elem for elem in classified_elements
        if make_elem_key(elem, target_label) not in analyzed_keys
        and make_elem_key(elem, target_label) not in failed_keys
    ])
        
    if unanalyzed_count == 0 and failed_elements and failed_retry_count < max_failed_retries:
        retry_attempt = failed_retry_count + 1
        print(
            f"[DEBUG] Retrying failed elements: current failed_retry_count={failed_retry_count}, "
            f"next_attempt={retry_attempt}, max={max_failed_retries}, state_id={id(state)}"
        )
        retry_msg = (
            f"Retrying {len(failed_elements)} failed elements "
            f"(attempt {retry_attempt}/{max_failed_retries})"
        )
        print(f"\n🔁 {retry_msg}")
        
        retry_elements = [elem for elem in failed_elements]
        return Command(
            update={
                "classified_elements": retry_elements,
                "failed_elements": [],
                "current_batch": [],
                "processed_count": len(analyzed_keys),
                "current_stage": "processing",
                "failed_retry_count": retry_attempt,
                "messages": state.get('messages', []) + [retry_msg]
            }
        )
    else:
        print(
            f"[DEBUG] No retry triggered: failed_retry_count={failed_retry_count}, max={max_failed_retries}, "
            f"failed_elements={len(failed_elements)}, unanalyzed_count={unanalyzed_count}"
        )
    
    if unanalyzed_count > 0:
        # More elements to analyze
        print(f"\n🔄 Continuing... ({len(analyzed_keys)}/{total_elements} successfully analyzed, {unanalyzed_count} remaining)")
        return Command(
            update={
                "current_stage": "processing"
            }
        )
    else:
        # All done - print summary
        print(f"\n✅ Analysis complete!")
        print(f"   Successfully analyzed: {len(analyzed_keys)}/{total_elements}")
        print(f"   Failed (need retry): {len(failed_elements)}")
        
        # Save failed elements to file for later retry
        if failed_elements:
            
            project_title = state.get('project_title', 'unknown')
            output_dir = Path("analysis_results")
            output_dir.mkdir(exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            failed_file = output_dir / f"{project_title}_{timestamp}_failed.json"
            
            with FILE_IO_LOCK:
                with open(failed_file, 'w', encoding='utf-8') as f:
                    json.dump(failed_elements, f, ensure_ascii=False, indent=2)
            
            print(f"\n⚠️  Failed elements saved to: {failed_file}")
            print(f"   You can retry these later by running analysis again with this file")
        
        # Print summary statistics
        project_title = state.get('project_title', 'unknown')
        output_dir = Path("analysis_results")
        output_dir.mkdir(exist_ok=True)
        latest_file = output_dir / f"{project_title}_latest.json"

        if all_analyzed:
            print(f"\n" + "="*80)
            print("📊 Analysis Summary")
            print("="*80)
            print(f"Total vulnerabilities analyzed: {len(all_analyzed)}")
            
            # Count by severity
            severity_counts = {}
            for vuln in all_analyzed:
                if not isinstance(vuln, dict):
                    print(f"   ⚠️  Skipping non-dict entry in all_analyzed: {vuln!r}")
                    continue
                severity = vuln.get('severity', 'Unknown')
                severity_counts[severity] = severity_counts.get(severity, 0) + 1
            
            print(f"\nBy Severity:")
            for severity in ['Critical', 'High', 'Medium', 'Low']:
                if severity in severity_counts:
                    print(f"  {severity}: {severity_counts[severity]}")
            
            # Count by CWE
            cwe_counts = {}
            for vuln in all_analyzed:
                if not isinstance(vuln, dict):
                    continue
                cwe = vuln.get('cwe', 'Unknown')
                cwe_counts[cwe] = cwe_counts.get(cwe, 0) + 1
            
            print(f"\nTop CWEs:")
            sorted_cwes = sorted(cwe_counts.items(), key=lambda x: x[1], reverse=True)
            for cwe, count in sorted_cwes[:5]:
                print(f"  {cwe}: {count}")
            
            # Print file locations
            print(f"\n📁 Results saved to:")
            print(f"  {latest_file.absolute()}")
            print("="*80)
        else:
            latest_file = _write_empty_result_files(project_title)
            print(f"\n📁 Results saved to:")
            print(f"  {latest_file.absolute()}")
            print("="*80)
        
        return Command(
            update={
                "current_stage": "completed"
            }
        )   