"""
Discovery Agent Nodes
"""
import json
import asyncio
from collections import defaultdict
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from langgraph.types import Command
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from ...models import DiscoveryState, VulnerabilityElement
from ...utils import (
    fetch_unseen_vulnerabilities,
    batch_update_vulnerabilities,
    split_elements_into_chunks,
    get_chunk_stats
)
from ...config import MAX_ANSWER_CHARS, DISCOVERY_TOOL_ONLY_RETRY_LIMIT
from ...utils.rate_limiter import get_rate_limiter
from ...utils.logging import get_logger

import json_repair


# Discovery agent often operates close to the model context window.
# Keeping these helpers in-module avoids an extra dependency and makes
# it easy to reason about the trimming heuristics in place.
DEFAULT_CONTEXT_LIMIT_TOKENS = 24000  # Sensible default for 30B-class models
CONTEXT_BUFFER_RATIO = 0.9            # Leave 10% headroom before the hard cap
MAX_HISTORY_MESSAGES = 8              # System + last N interactions is sufficient


def _is_json_seed_mode(state: DiscoveryState) -> bool:
    source = state.get("seed_source") or "http"
    return isinstance(source, str) and source.lower() == "json"


def _load_seed_entries_from_file(file_path: Optional[str]) -> List[VulnerabilityElement]:
    if not file_path:
        return []
    path = Path(file_path)
    if not path.exists():
        print(f"   ⚠️ Local seed file not found: {path}")
        return []
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except Exception as exc:
        print(f"   ⚠️ Failed to read local seed file {path}: {exc}")
        return []
    if isinstance(payload, dict) and "elements" in payload:
        payload = payload["elements"]
    if not isinstance(payload, list):
        print(f"   ⚠️ Local seed file must contain a list, got {type(payload).__name__}")
        return []
    return payload  # type: ignore[return-value]


def _write_seed_entries_to_file(file_path: str, entries: List[VulnerabilityElement]) -> None:
    path = Path(file_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(entries, handle, ensure_ascii=False, indent=2)


def _normalize_line_identifier(line_value: Any) -> str:
    if isinstance(line_value, slice):
        start = line_value.start if line_value.start is not None else ""
        stop = line_value.stop if line_value.stop is not None else ""
        return f"{start}-{stop}"
    if line_value is None:
        return ""
    return str(line_value)


def _make_seed_key(entry: Dict[str, Any]) -> Optional[Tuple[str, str]]:
    file_path = entry.get("file_path")
    if not file_path:
        return None
    return file_path, _normalize_line_identifier(entry.get("line_num"))


def _has_vulnerability_types(entry: Dict[str, Any]) -> bool:
    vuln_types = entry.get("vulnerability_types")
    return bool(vuln_types)


def _apply_classifications_to_local_file(
    file_path: str,
    classified_batch: List[VulnerabilityElement]
) -> Tuple[int, int]:
    entries = _load_seed_entries_from_file(file_path)
    if not entries:
        return 0, 0
    index_map: Dict[Tuple[str, str], List[int]] = defaultdict(list)
    for idx, entry in enumerate(entries):
        key = _make_seed_key(entry)
        if key:
            index_map[key].append(idx)
    updated = 0
    for result in classified_batch:
        key = _make_seed_key(result)
        if not key:
            continue
        candidates = index_map.get(key)
        if not candidates:
            continue
        entry_idx = candidates.pop(0)
        merged = dict(entries[entry_idx])
        merged.update(result)
        entries[entry_idx] = merged
        updated += 1
    _write_seed_entries_to_file(file_path, entries)
    return updated, len(entries)


def _estimate_tokens_from_text(text: str) -> int:
    """Rough token estimation (fallback when tokenizer metadata is unavailable)."""
    if not text:
        return 0
    # Empirical rule-of-thumb: 1 token ~ 4 characters for mixed text/code.
    return max(1, len(text) // 4)


def _estimate_tokens_from_messages(messages: List[Dict[str, Any]]) -> int:
    """Estimate total token usage for a sequence of OpenAI-style chat messages."""
    total = 0
    for message in messages:
        content = ""
        if isinstance(message, dict):
            content = str(message.get("content", ""))
        else:
            content = str(message)
        total += _estimate_tokens_from_text(content)
    return total


def _detect_context_limit(llm) -> int:
    """Try to infer the provider-specific context window; fallback to default."""
    for attr in ("max_context_tokens", "context_window", "max_tokens", "max_input_tokens"):
        value = getattr(llm, attr, None)
        if isinstance(value, int) and value > 0:
            return value

    # LangChain chat models sometimes expose limits inside model_kwargs
    model_kwargs = getattr(llm, "model_kwargs", None)
    if isinstance(model_kwargs, dict):
        for key in ("max_context_tokens", "context_window", "max_tokens"):
            value = model_kwargs.get(key)
            if isinstance(value, int) and value > 0:
                return value

    return DEFAULT_CONTEXT_LIMIT_TOKENS


def _get_model_name(llm: Any) -> str:
    """Best-effort extraction of underlying LLM identifier for logging."""
    for attr in ("model_name", "model", "deployment_name"):
        value = getattr(llm, attr, None)
        if isinstance(value, str) and value:
            return value
    return llm.__class__.__name__


def _prune_message_history(
    messages: List[Dict[str, Any]],
    max_tokens: int,
    preserve_tail: int = 0
) -> List[Dict[str, Any]]:
    """
    Trim conversation history so only the system prompt + most recent exchanges remain.

    This keeps Discovery batches lightweight while still allowing the LLM to see
    the latest tool interaction if needed.
    """
    if not messages or max_tokens <= 0:
        return messages

    system_messages = [msg for msg in messages if isinstance(msg, dict) and msg.get("role") == "system"]
    non_system = [msg for msg in messages if not (isinstance(msg, dict) and msg.get("role") == "system")]

    # Keep system prompt (first occurrence) and the most recent interactions.
    pruned: List[Dict[str, Any]] = []
    if system_messages:
        pruned.append(system_messages[0])

    pruned.extend(non_system[-MAX_HISTORY_MESSAGES:])

    token_budget = int(max_tokens * CONTEXT_BUFFER_RATIO)
    if token_budget <= 0:
        return pruned

    # Drop the oldest non-system messages until we fit within the budget.
    while len(pruned) > 1 and _estimate_tokens_from_messages(pruned) > token_budget:
        # Never drop the final message (current user request). Remove the oldest non-system entry.
        # pruned[0] is system -> start from index 1.
        if len(pruned) <= 2:
            break
        non_system_count = len(pruned) - 1
        if preserve_tail and non_system_count <= preserve_tail:
            break
        pruned.pop(1)

    return pruned


def _count_trailing_tool_exchange(messages: List[Dict[str, Any]]) -> int:
    """
    Count trailing messages that belong to the latest tool exchange for Anthropic.
    Returns number of non-system trailing messages (tool_result blocks + tool_use anchor)
    that must be preserved to keep tool_use/tool_result pairing valid.
    """
    preserve = 0
    idx = len(messages) - 1

    # Count trailing tool_result user messages
    while idx >= 0:
        msg = messages[idx]
        if not isinstance(msg, dict):
            break
        if msg.get("role") != "user":
            break
        content = msg.get("content")
        if isinstance(content, list) and all(
            isinstance(block, dict) and block.get("type") == "tool_result"
            for block in content
        ):
            preserve += 1
            idx -= 1
            continue
        break

    # Include the assistant message that contained the matching tool_use blocks
    if preserve > 0 and idx >= 0:
        msg = messages[idx]
        if isinstance(msg, dict) and msg.get("role") == "assistant":
            content = msg.get("content")
            if isinstance(content, list) and any(
                isinstance(block, dict) and block.get("type") == "tool_use"
                for block in content
            ):
                preserve += 1

    return preserve


def _prune_for_provider(
    messages: List[Dict[str, Any]],
    max_tokens: int,
    provider: str
) -> List[Dict[str, Any]]:
    """
    Wrapper around _prune_message_history with provider-specific preservation.
    Currently ensures Anthropic retains the latest tool_use/tool_result bundle.
    """
    preserve_tail = 0
    if provider == "anthropic":
        preserve_tail = _count_trailing_tool_exchange(messages)
    return _prune_message_history(messages, max_tokens, preserve_tail=preserve_tail)


def fetch_unseen(state: DiscoveryState) -> Command:
    """
    Fetch unseen vulnerability elements from API
    """
    project_title = state.get('project_title')
    
    if not project_title:
        print("❌ No project_title provided")
        return Command(
            update={
                "unseen_elements": [],
                "total_elements": 0,
                "current_stage": "error",
                "messages": state.get('messages', []) + ["Error: No project_title"]
            }
        )

    if _is_json_seed_mode(state):
        local_seed_file = state.get("local_seed_file")
        unseen_elements = [
            elem for elem in _load_seed_entries_from_file(local_seed_file)
            if not _has_vulnerability_types(elem)
        ]
        print(f"\n📥 Loading unseen JSON elements for project: {project_title}")
        if local_seed_file:
            print(f"   Source file: {local_seed_file}")
    else:
        print(f"\n📥 Fetching unseen elements for project: {project_title}")

        # Fetch from API (sync wrapper for async call)
        async def fetch():
            return await fetch_unseen_vulnerabilities(project_title)

        unseen_elements = asyncio.run(fetch())
    
    if not unseen_elements:
        print("✅ No unseen elements - Discovery complete!")
        return Command(
            update={
                "unseen_elements": [],
                "total_elements": 0,
                "current_stage": "completed",
                "messages": state.get('messages', []) + ["No unseen elements"]
            }
        )
    
    print(f"📊 Total unseen elements: {len(unseen_elements)}")
    
    return Command(
        update={
            "unseen_elements": unseen_elements,
            "total_elements": len(unseen_elements),
            "processed_count": state.get('processed_count', 0),
            "current_stage": "fetched",
            "messages": state.get('messages', []) + [
                f"Fetched {len(unseen_elements)} unseen elements"
            ]
        }
    )


def prepare_batch(state: DiscoveryState) -> Command:
    """
    Prepare next batch for classification (split into chunks)
    """
    unseen_elements = state.get('unseen_elements', [])
    
    if not unseen_elements:
        return Command(
            update={
                "current_batch": [],
                "current_stage": "completed"
            }
        )
    
    # Split into chunks
    chunks = split_elements_into_chunks(unseen_elements)
    
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
    remaining_elements = []
    
    # Flatten remaining chunks
    for chunk in chunks[1:]:
        remaining_elements.extend(chunk)
    
    processed_count = state.get('processed_count', 0)
    total_elements = state.get('total_elements', 0)
    
    print(f"\n🔄 Processing batch: {processed_count + len(current_batch)}/{total_elements} ({(processed_count + len(current_batch)) / total_elements * 100:.1f}%)")
    
    return Command(
        update={
            "current_batch": current_batch,
            "unseen_elements": remaining_elements,
            "current_stage": "prepared"
        }
    )



async def classify_batch(state: DiscoveryState, llm, mcp_client, provider: str = "unknown") -> Command:
    """
    Classify vulnerability types for current batch using LLM + MCP

    Args:
        state: Current state
        llm: Language model instance
        mcp_client: MCP client for tools
        provider: LLM provider (google/groq/openai)
    """
    current_batch = list(state.get('current_batch', []))

    if not current_batch:
        # If we are already completed (from prepare_batch), preserve that state!
        if state.get("current_stage") == "completed":
             return Command(update={})
             
        return Command(
            update={
                "classified_batch": [],
                "current_stage": "classified"
            }
        )

    overflow_items: List[VulnerabilityElement] = []
    remaining_unseen_base = list(state.get('unseen_elements', []))
    processed_count = state.get('processed_count', 0)
    total_elements = state.get('total_elements', 0)

    print(f"\n[Discovery] Classifying batch ({len(current_batch)} elements)...")
    print(f"   Progress: {processed_count}/{total_elements} ({processed_count / total_elements * 100:.1f}%)")

    system_prompt = """<role>
You are the world's leading expert in static source code auditing for vulnerabilities. You are responsible for the "Discovery" phase of a vulnerability analysis system.
</role>

<task>
You must analyze each element in a JSON array representing source-to-sink flows. Each element contains:
- file_path (string): the relative path of the source file
- line_num (string): line number or range
- code_snippet (string): code content to evaluate
</task>

<rules>
<strictBehavior>
You must act with extreme rigor. Never guess. Never make assumptions.
</strictBehavior>


</rules>

<vulnerabilityTypes>
<type>XSS</type>
<type>SQLI</type>
<type>SSRF</type>
<type>OpenRedirect</type>
<type>InsecureDeserialization</type>
<type>IDOR</type>
<type>NO</type>
<type>CommandInjection</type>
<type>PathTraversal</type>
<type>CodeInjection</type>
</vulnerabilityTypes>

<outputFormat>
Return a raw JSON array. Each object must include:
- vulnerability_types: array of strings from the list above
- file_path: string
- line_num: string
- discovery_reason: string explaining why this looks vulnerable (cite evidence from code)

Do not include any commentary, Markdown markers, or formatting. only pure valid JSON.
</outputFormat>

<examples><![CDATA[
[
{
"vulnerability_types": ["XSS"],
"file_path": "components/CommentView.jsx",
"line_num": "45",
"discovery_reason": "User comment is inserted into innerHTML without escaping. A template literal renders the value directly into the DOM, creating a stored XSS path."
},
{
"vulnerability_types": ["SSRF"],
"file_path": "controllers/fetchController.py",
"line_num": "88-95",
"discovery_reason": "web_client makes outbound HTTP requests to user-controlled URLs with redirect handling enabled. Missing hostname/IP validation means internal network endpoints can be reached (classic SSRF vector)."
}
]
]]></examples>

<decisionPolicy>
- If clearly safe: ["NO"]
- If plausibly vulnerable: specify types
- Do not deduplicate unless entries are exact duplicates
</decisionPolicy>


<sanitizerPolicy>
- Identify sanitizers used
- Indicate where their outputs are used
- Let the analyst determine bypassability
</sanitizerPolicy>


<toolInvocationNote>
<IMPORTANT>
When calling any tool, always send a JSON object for the input.
If a tool has no parameters, set input to {} (an empty object), never a string or null.
</IMPORTANT>

- If tool returns "output truncated" or "max_answer_chars too small":
    DO NOT SKIP - You MUST get the complete data
    Options:
    a) Use more specific patterns to narrow results (e.g., add file path filters)
    b) Split the search into multiple smaller searches
    c) Increase max_answer_chars
</toolInvocationNote>

CRITICAL: After you finish using tools to gather information, you MUST generate the final JSON output following the exact schema provided.

Your response must be ONLY the raw JSON array. Do not wrap it in markdown code blocks. Do not add any explanatory text before or after the JSON. Just return the pure JSON array starting with [ and ending with ].
"""

    def build_user_message(batch: List[VulnerabilityElement]) -> str:
        batch_json_local = json.dumps(batch, ensure_ascii=False, indent=2)
        return (
            "Analyze the following vulnerability seed elements and classify each one.\n\n"
            "Elements to analyze:\n"
            f"{batch_json_local}\n\n"
        )

    user_message = build_user_message(current_batch)

    if not current_batch:
        original_batch = list(state.get('current_batch', []))
        if original_batch:
            current_batch = [original_batch[0]]
            overflow_items = original_batch[1:] + overflow_items
            user_message = build_user_message(current_batch)

    if overflow_items:
        print(f"   [trim] Batch trimmed to {len(current_batch)} item(s) to fit model context window")
        print(f"   [trim] Re-queued {len(overflow_items)} item(s) for a later batch")

    max_context_tokens = _detect_context_limit(llm)
    target_context_tokens = int(max_context_tokens * CONTEXT_BUFFER_RATIO)

    def estimate_payload_tokens(batch: List[VulnerabilityElement]) -> int:
        payload = build_user_message(batch)
        prompt_tokens = (
            _estimate_tokens_from_text(system_prompt)
            + _estimate_tokens_from_text(payload)
            + 2000  # reserve budget for responses/tool chatter
        )
        return prompt_tokens

    while len(current_batch) > 1 and estimate_payload_tokens(current_batch) > target_context_tokens:
        overflow_items.insert(0, current_batch.pop())

    user_message = build_user_message(current_batch)

    estimated_after_trim = estimate_payload_tokens(current_batch)
    if len(current_batch) == 1 and estimated_after_trim > max_context_tokens:
        print("   [warn] Single element still exceeds context window; proceeding anyway")

    if overflow_items:
        print(f"   [trim] Batch trimmed to {len(current_batch)} item(s) to fit context window")
        print(f"   [trim] Deferred {len(overflow_items)} item(s) for later processing")

    tools: List[Any] = []
    if mcp_client:
        try:
            print("\n" + "=" * 80)
            print("[MCP] Binding available tools")
            print("=" * 80)
            all_tools = await mcp_client.get_tools()
            print("[MCP] Available tools:")
            for index, tool in enumerate(all_tools, 1):
                tool_name = getattr(tool, "name", f"tool_{index}")
                print(f"  {index}. {tool_name}")

            # ALLOWED_TOOLS = [
            #     "list_dir",
            #     "read_file",
            #     "search_for_pattern",
            #     "find_symbol",
            #     "get_symbols_overview",
            # ]
            BLOCKED_TOOLS = [
                "replace_symbol_body",
                "insert_after_symbol",
                "insert_before_symbol",
                "write_memory",
                "read_memory",
                "list_memories",
                "delete_memory",
                "execute_shell_command",
                "activate_project",
                "switch_modes",
                "get_current_config",
                "check_onboarding_performed",
                "onboarding",
                "think_about_collected_information",
                "think_about_task_adherence",
                "think_about_whether_you_are_done",
                "prepare_for_new_conversation",
            ]

            # Use allow-list to keep discovery safe and focused
            # if ALLOWED_TOOLS:
            #     tools = [tool for tool in all_tools if tool.name in ALLOWED_TOOLS]
            # else:
            tools = [tool for tool in all_tools if tool.name not in BLOCKED_TOOLS]

            if tools:
                print(f"[MCP] Bound {len(tools)} tool(s) after filtering")
            else:
                print("[MCP] No tools available after filtering")
            print("=" * 80)
        except Exception as e:
            print("\n" + "=" * 80)
            print("[MCP] Tool binding failed")
            print("=" * 80)
            print(f"Error: {e}")
            print(f"Error type: {type(e).__name__}")
            import traceback
            print("\nFull traceback:")
            traceback.print_exc()
            print("=" * 80)
            tools = []

    agent = create_react_agent(llm, tools)

    rate_limiter = get_rate_limiter(provider)
    estimated_tokens = (
        _estimate_tokens_from_text(system_prompt)
        + _estimate_tokens_from_text(user_message)
        + 2000
    )

    stats = rate_limiter.get_stats()
    print("\n" + "=" * 80)
    print(f"[RateLimiter:{provider.upper()}]")
    print("=" * 80)
    print(f"RPM: {stats['rpm']['current']}/{stats['rpm']['limit']} (available: {stats['rpm']['available']})")
    if stats['tpm']['limit'] is not None:
        print(f"TPM: {stats['tpm']['current']}/{stats['tpm']['limit']} (available: {stats['tpm']['available']})")
    print(f"Estimated tokens for this request: {estimated_tokens}")
    print("=" * 80)

    await rate_limiter.acquire(estimated_tokens=estimated_tokens)

    input_messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_message)
    ]

    model_name = _get_model_name(llm)
    logger = get_logger()
    if logger:
        logger.log_llm_request(model_name, input_messages, len(tools))

    print("\n" + "=" * 80)
    print("[LLM] Request")
    print("=" * 80)
    print(f"Provider: {provider}")
    print(f"Model: {model_name}")
    print(f"Temperature: {getattr(llm, 'temperature', 'Unknown')}")
    print(f"Tools attached: {len(tools)}")
    print(f"\nSystem prompt length: {len(system_prompt)} chars")
    print(f"User message length: {len(user_message)} chars")
    print(f"\nUser message preview (first 500 chars):")
    print(user_message[:500])
    print("=" * 80)

    try:
        agent_result = await agent.ainvoke(
            {"messages": input_messages},
            config={
                "recursion_limit": max(DISCOVERY_TOOL_ONLY_RETRY_LIMIT, 10),
            }
        )
    except Exception as e:
        import traceback

        print(f"[LLM] Classification error: {e}")
        if logger:
            logger.log_error("classify_batch", e, traceback.format_exc())
        traceback.print_exc()
        retry_queue = current_batch + overflow_items + remaining_unseen_base
        return Command(
            update={
                "classified_batch": [],
                "processed_count": processed_count,
                "current_stage": "processing",
                "messages": state.get('messages', []) + [
                    f"Classification error: {str(e)}"
                ],
                "current_batch": [],
                "unseen_elements": retry_queue
            }
        )

    final_messages = agent_result.get("messages", []) or []
    if not isinstance(final_messages, list):
        final_messages = list(final_messages)

    if not final_messages:
        print("[LLM] Agent returned no messages")
        return Command(
            update={
                "classified_batch": [],
                "processed_count": processed_count + len(current_batch),
                "current_stage": "classified",
                "messages": state.get('messages', []) + [
                    "Agent returned no messages"
                ],
                "current_batch": current_batch,
                "unseen_elements": overflow_items + remaining_unseen_base
            }
        )

    if logger:
        for msg in final_messages:
            if isinstance(msg, ToolMessage):
                logger.log_mcp_response(getattr(msg, 'name', 'tool'), getattr(msg, 'content', ''))
            elif isinstance(msg, AIMessage):
                tool_calls = getattr(msg, "tool_calls", None) or []
                for tool_call in tool_calls:
                    if isinstance(tool_call, dict):
                        tool_name = tool_call.get("name", "unknown")
                        tool_args = tool_call.get("args", {})
                    else:
                        tool_name = getattr(tool_call, "name", "unknown")
                        tool_args = getattr(tool_call, "args", {})
                    if not isinstance(tool_args, dict):
                        tool_args = {"raw": str(tool_args)}
                    logger.log_mcp_request(tool_name, tool_args)
                logger.log_llm_response(getattr(msg, 'content', ''), full_response=msg)

    final_ai_message = None
    for msg in reversed(final_messages):
        if isinstance(msg, AIMessage) and not getattr(msg, 'tool_calls', None):
            final_ai_message = msg
            break
    if final_ai_message is None:
        for msg in reversed(final_messages):
            if isinstance(msg, AIMessage):
                final_ai_message = msg
                break

    if final_ai_message is None or not getattr(final_ai_message, 'content', '').strip():
        print("[LLM] No final response from agent")
        return Command(
            update={
                "classified_batch": [],
                "processed_count": processed_count + len(current_batch),
                "current_stage": "classified",
                "messages": state.get('messages', []) + [
                    "Agent produced no final response"
                ],
                "current_batch": current_batch,
                "unseen_elements": overflow_items + remaining_unseen_base
            }
        )

    result_text = final_ai_message.content or ""
    print("\n" + "=" * 80)
    print("[LLM] Response received")
    print("=" * 80)
    print(f"Response length: {len(result_text)} chars")
    print(f"\nResponse preview (first 1000 chars):")
    print(result_text[:1000])
    if len(result_text) > 1000:
        print(f"... (truncated, total {len(result_text)} chars)")
    print("=" * 80)

    sanitized_result = result_text.strip()
    if "```json" in sanitized_result:
        sanitized_result = sanitized_result.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in sanitized_result:
        sanitized_result = sanitized_result.split("```", 1)[1].split("```", 1)[0].strip()

    if not sanitized_result:
        print("[LLM] Empty response after sanitation")
        return Command(
            update={
                "classified_batch": [],
                "processed_count": processed_count + len(current_batch),
                "current_stage": "classified",
                "messages": state.get('messages', []) + [
                    "Empty response from agent"
                ],
                "current_batch": current_batch,
                "unseen_elements": overflow_items + remaining_unseen_base
            }
        )

    try:
        classified_batch = []
        try:
            classified_batch = json.loads(sanitized_result)
        except Exception as e1:
            print(f"[LLM] JSON decode error, attempting repair: {e1}")
            try:
                classified_batch = json_repair.loads(sanitized_result)
            except Exception as e2:
                print(f"[LLM] JSON repair error: {e2}")
                raise e2 from e1
        if isinstance(classified_batch, dict):
            classified_batch = [classified_batch]
        if not isinstance(classified_batch, list):
            raise ValueError("Agent did not return a JSON array")
    except Exception as e:
        import traceback

        print(f"[LLM] Failed to parse response as JSON: {e}")
        print(f"Response preview: {sanitized_result[:500]}...")
        if logger:
            logger.log_error("classify_batch_parse", e, traceback.format_exc())
        retry_queue = current_batch + overflow_items + remaining_unseen_base
        return Command(
            update={
                "classified_batch": [],
                "processed_count": processed_count,
                "current_stage": "processing",
                "messages": state.get('messages', []) + [
                    f"Failed to parse batch: {str(e)}"
                ],
                "current_batch": [],
                "unseen_elements": retry_queue
            }
        )

    print(f"   Classified {len(classified_batch)} elements")
    
    # Since DiscoveryState uses operator.add for all_classified, 
    # we just pass the NEW items. LangGraph will append them.
    return Command(
        update={
            "classified_batch": classified_batch,
            "all_classified": classified_batch,
            "processed_count": processed_count + len(current_batch),
            "current_stage": "classified",
            "current_batch": current_batch,
            "unseen_elements": overflow_items + remaining_unseen_base
        }
    )

def update_api(state: DiscoveryState) -> Command:
    """
    Send classified batch back to API
    """
    classified_batch = state.get('classified_batch', [])
    project_title = state.get('project_title')
    
    if not classified_batch:
        print("   ⏭️  No classified elements to update")
        return Command(
            update={
                "current_stage": "updated"
            }
        )
    if _is_json_seed_mode(state):
        local_seed_file = state.get("local_seed_file")
        if not local_seed_file:
            print("   ⚠️ Local seed file missing - cannot persist JSON results")
            return Command(
                update={
                    "current_stage": "updated",
                    "messages": state.get('messages', []) + [
                        "Failed to persist JSON results (missing file)"
                    ]
                }
            )
        updated_count, total_entries = _apply_classifications_to_local_file(
            local_seed_file,
            classified_batch
        )
        if updated_count < len(classified_batch):
            print(f"   ⚠️ Only matched {updated_count}/{len(classified_batch)} elements in local JSON")
        print(f"   💾 Saved discovery results to {local_seed_file}")
        return Command(
            update={
                "current_stage": "updated",
                "messages": state.get('messages', []) + [
                    f"Persisted {updated_count} elements to {local_seed_file}"
                ]
            }
        )
    
    print(f"\n📤 Updating API with {len(classified_batch)} classified elements...")
    
    # Update via API
    async def update():
        return await batch_update_vulnerabilities(project_title, classified_batch)
    
    result = asyncio.run(update())
    
    if "error" in result:
        print(f"   ⚠️  Update failed: {result['error']}")
    else:
        print(f"   ✅ Update successful")
    
    return Command(
        update={
            "current_stage": "updated",
            "messages": state.get('messages', []) + [
                f"Updated {len(classified_batch)} elements"
            ]
        }
    )


def check_completion(state: DiscoveryState) -> Command:
    """
    Check if all elements have been processed
    """
    unseen_elements = state.get('unseen_elements', [])
    current_stage = state.get('current_stage', '')
    processed_count = state.get('processed_count', 0)
    total_elements = state.get('total_elements', 0)
    
    # If we just completed a batch and there are more elements in memory
    if unseen_elements:
        # More elements to process in current batch
        print(f"\n🔄 Continuing... ({processed_count}/{total_elements} processed)")
        return Command(
            update={
                "current_stage": "processing"
            }
        )
    
    # If current_stage is already 'completed' from fetch_unseen, don't loop
    if current_stage == "completed":
        print(f"\n✅ Discovery complete! All elements classified.")
        return Command(
            update={
                "current_stage": "completed"
            }
        )
    
    # Otherwise, fetch again to check for new unseen elements
    print(f"\n✅ Batch complete. Checking for more unseen elements...")
    return Command(
        update={
            "current_stage": "checking"  # Will fetch again, but can complete
        }
    )


def _normalize_llm_content(content: Any) -> str:
    """
    Normalize LLM response content to plain string.
    Handles Anthropic-style list of content blocks.
    """
    if content is None:
        return ""
    if isinstance(content, list):
        parts: List[str] = []
        for block in content:
            text = ""
            if isinstance(block, dict):
                block_type = block.get("type")
                if block_type == "text":
                    text = block.get("text") or ""
                elif block_type == "tool_result":
                    text = block.get("content") or ""
                else:
                    text = ""
            elif hasattr(block, "text"):
                text = getattr(block, "text") or ""
            else:
                text = str(block)
            if text:
                parts.append(text)
        return "".join(parts)
    if isinstance(content, str):
        return content
    return str(content)
