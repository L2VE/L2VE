"""Pipeline to classify SARIF-derived findings with an LLM and MCP tools.

Each seed finding is examined by a single agent that labels it as a
true/false positive while capturing every MCP 도구 호출.
Configuration is driven by environment variables (see `Config` below)
to keep the module flexible without hardcoding runtime details.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Literal, Optional, Sequence, TypedDict, cast
from dotenv import load_dotenv

from langchain.agents import create_agent
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage, SystemMessage
from langchain_core.tools import BaseTool
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from langchain_anthropic import ChatAnthropic
from langchain_mcp_adapters.sessions import create_session
from langchain_mcp_adapters.tools import load_mcp_tools
from langchain_teddynote import logging
from langchain_core.output_parsers import PydanticOutputParser
from langgraph.graph import END, StateGraph
from pydantic import BaseModel
from json_repair import repair_json

LOG_TIME_FORMAT = '%H:%M:%S'
JSON_TOOL_NAME = "json"

load_dotenv()
# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
@dataclass
class Config:
    """Runtime configuration loaded from environment variables."""

    seed_path: Path = Path(os.getenv("SARIF_SEED_PATH", "./vulnshop_snippet_add_extract.json"))
    batch_size: int = int(os.getenv("SARIF_BATCH_SIZE", "2"))
    mcp_url: str = os.getenv("MCP_SERVER_URL") or os.getenv("SARIF_MCP_URL", "http://localhost:8000/mcp") # http://localhost:8000/mcp, http://localhost:9121/mcp
    llm_provider: str = os.getenv("SARIF_LLM_PROVIDER", "openrouter").lower() # groq, openai, openrouter, anthropic
    model_name: str = os.getenv("SARIF_MODEL_NAME", "x-ai/grok-4.1-fast") 
    project_title: str = ""
    # openai:
    # gpt-5
    # groq:
    # qwen/qwen3-32b 
    # openai/gpt-oss-120b
    # openai/gpt-oss-20b
    # anthropic:
    # claude-sonnet-4-5
    # openrouter:
    # qwen/qwen3-30b-a3b-instruct-2507
    # qwen/qwen3-235b-a22b-thinking-2507
    # z-ai/glm-4.6
    # deepseek/deepseek-chat-v3.1
    # deepseek/deepseek-v3.2-exp
    # x-ai/grok-code-fast-1
    # x-ai/grok-4.1-fast
    temperature: float = float(os.getenv("SARIF_TEMPERATURE", "0.1"))
    top_p: float = float(os.getenv("SARIF_TOP_P", "0.9"))
    json_tool_mode: str = os.getenv("SARIF_JSON_TOOL_MODE", "auto").lower()
    openrouter_api_key : str = os.getenv("OPENROUTER_API_KEY")
    include_tool_usage: str = os.getenv("SARIF_INCLUDE_TOOL_USAGE", "off").lower()  # on/off
    max_classification_attempts: int = int(os.getenv("SARIF_MAX_CLASSIFICATION_ATTEMPTS", "2"))

    def validate(self) -> None:
        if self.batch_size <= 0:
            raise ValueError("SARIF_BATCH_SIZE must be greater than zero.")
        if self.json_tool_mode not in {"auto", "on", "off"}:
            raise ValueError("SARIF_JSON_TOOL_MODE must be one of: auto, on, off")
        if self.include_tool_usage not in {"on", "off"}:
            raise ValueError("SARIF_INCLUDE_TOOL_USAGE must be one of: on, off")

    def should_enable_json_tool(self) -> bool:
        if self.json_tool_mode == "on":
            return True
        if self.json_tool_mode == "off":
            return False
        indicator = self.model_name.lower()
        return "gpt-oss" in indicator or "json" in indicator

    def should_include_tool_usage(self) -> bool:
        return self.include_tool_usage == "on"




CONFIG = Config()
CONFIG.validate()
JSON_TOOL_ENABLED = CONFIG.should_enable_json_tool()
INCLUDE_TOOL_USAGE = CONFIG.should_include_tool_usage()


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------
class SeedFinding(TypedDict, total=False):
    id: str
    vulnerability_info: str
    sink: Dict[str, Any]
    source: List[Dict[str, Any]]
    taint_flow: List[Any]


class ClassificationResult(TypedDict, total=False):
    id: str
    verdict: str
    details: Any
    notes: Any
    tool_usage: Dict[str, List[Dict[str, Any]]]


class PipelineResult(TypedDict):
    classifications: List[ClassificationResult]
    analysis_file: str
    errors: List[str]
    summary: Dict[str, Any]


class GraphState(TypedDict, total=False):
    queue: List[SeedFinding]
    batch: List[SeedFinding]
    batch_index: int
    finding: SeedFinding
    classification: ClassificationResult
    classifications: List[ClassificationResult]
    errors: List[str]
    report: Dict[str, Any]
    reports: List[Dict[str, Any]]


# ---------------------------------------------------------------------------
# Structured output schemas
# ---------------------------------------------------------------------------
class ClassificationSchema(BaseModel):
    id: Optional[str | int] = None
    verdict: Literal["true_positive", "false_positive"]
    details: Any
    notes: Optional[Any] = None


PRIMARY_OUTPUT_PARSER = PydanticOutputParser(pydantic_object=ClassificationSchema)

# ---------------------------------------------------------------------------
# Report output schema
# ---------------------------------------------------------------------------
class ReportLocation(BaseModel):
    file_path: Optional[str] = None
    line_number: Optional[str | int] = None


class ReportFlowNode(BaseModel):
    file_path: Optional[str] = None
    line_number: Optional[str | int] = None
    explanation: Optional[str] = None
    code_snippet: Optional[str] = None


class ReportTaintFlow(BaseModel):
    source: Optional[ReportFlowNode] = None
    sink: Optional[ReportFlowNode] = None
    propagation: Optional[List[ReportFlowNode]] = None


class ReportPoC(BaseModel):
    scenario: Optional[str] = None
    example: Optional[str] = None


class ReportRecommendation(BaseModel):
    how_to_fix: Optional[str] = None
    code_example_fix: Optional[str] = None


class ReportPatch(BaseModel):
    target_file: Optional[str] = None
    line_range: Optional[str] = None
    original_snippet: Optional[str] = None
    modified_snippet: Optional[str] = None
    notes: Optional[str] = None


class ReportTestPlan(BaseModel):
    description: Optional[str] = None
    framework: Optional[str] = None
    dependencies: Optional[List[str]] = None
    file_path: Optional[str] = None
    setup_commands: Optional[List[str]] = None
    command: Optional[str] = None
    script: Optional[str] = None


class ReportSchema(BaseModel):
    id: Optional[str | int] = None
    vulnerability_title: Optional[str] = None
    severity: Optional[str] = None
    cwe: Optional[str] = None
    location: Optional[ReportLocation] = None
    description: Optional[str] = None
    taint_flow_analysis: Optional[ReportTaintFlow] = None
    proof_of_concept: Optional[ReportPoC] = None
    recommendation: Optional[ReportRecommendation] = None
    code_fix_patch: Optional[ReportPatch] = None
    functional_test: Optional[ReportTestPlan] = None
    security_regression_test: Optional[ReportTestPlan] = None


REPORT_OUTPUT_PARSER = PydanticOutputParser(pydantic_object=ReportSchema)


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------
def chunk_iterable(items: Sequence[SeedFinding], size: int) -> Iterable[Sequence[SeedFinding]]:
    """Yield fixed-size chunks from `items`."""
    for idx in range(0, len(items), size):
        yield items[idx : idx + size]


def log_progress(message: str) -> None:
    timestamp = datetime.now().strftime(LOG_TIME_FORMAT)
    print(f'[{timestamp}] {message}')


def load_seed_file(path: Path) -> List[SeedFinding]:
    """Load seed findings from disk."""
    if not path.exists():
        raise FileNotFoundError(f"Seed file not found: {path}")
    with path.open("r", encoding="utf-8") as fp:
        data = json.load(fp)
    if not isinstance(data, list):
        raise ValueError("Seed file must contain a list of findings.")
    return data  # type: ignore[return-value]


def make_json_safe(value: Any) -> Any:
    """Convert LangChain-specific objects into JSON-serialisable structures."""
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, dict):
        return {str(k): make_json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [make_json_safe(v) for v in value]
    if isinstance(value, BaseMessage):
        return {
            "type": value.type,
            "content": make_json_safe(value.content),
            "additional_kwargs": make_json_safe(value.additional_kwargs),
        }
    return str(value)


def _extract_dict_content(candidate: Any) -> Optional[str]:
    if isinstance(candidate, dict):
        content = candidate.get("content")
        if content is None:
            return None
        if isinstance(content, str):
            return content
        return _stringify_content(content)
    return None


def _model_to_dict(model: BaseModel) -> Dict[str, Any]:
    """Normalize Pydantic v1/v2 model to a plain dict."""
    if hasattr(model, "model_dump"):
        return model.model_dump()  # type: ignore[attr-defined]
    return model.dict()


class JsonRelayTool(BaseTool):
    """Pass-through tool for JSON-formatted final answers."""

    name: str = JSON_TOOL_NAME
    description: str = "최종 답변을 JSON으로 반환할 때 사용하세요. 입력받은 구조를 그대로 돌려줍니다."
    args_schema: Dict[str, Any] = {"type": "object", "additionalProperties": True}

    def _normalise_payload(
        self,
        primary: Optional[Dict[str, Any]],
        fallback_args: Sequence[Any],
        fallback_kwargs: Dict[str, Any],
    ) -> Dict[str, Any]:
        if isinstance(primary, dict):
            return primary
        if fallback_args:
            candidate = fallback_args[0]
            if isinstance(candidate, dict):
                return candidate
        return {
            key: value
            for key, value in fallback_kwargs.items()
            if key not in {"run_manager"}
        }

    def _run(
        self,
        *args: Any,
        tool_input: Optional[Dict[str, Any]] = None,
        run_manager: Any | None = None,
        **kwargs: Any,
    ) -> str:
        payload = self._normalise_payload(tool_input, args, kwargs)
        return json.dumps(payload, ensure_ascii=False)

    async def _arun(
        self,
        *args: Any,
        tool_input: Optional[Dict[str, Any]] = None,
        run_manager: Any | None = None,
        **kwargs: Any,
    ) -> str:
        return self._run(
            *args, tool_input=tool_input, run_manager=run_manager, **kwargs
        )


INVALID_ESCAPE_RE = re.compile(r"\\([^\"\\/bfnrtu])")


BACKTICK_CONTENT_RE = re.compile(r"`([^`]+)`")


def _escape_quotes_in_backticks(text: str) -> str:
    """Escape double quotes that appear inside backtick segments."""
    def repl(match: re.Match[str]) -> str:
        content = match.group(1)
        escaped = content.replace('"', r'\\"')
        return f"`{escaped}`"

    return BACKTICK_CONTENT_RE.sub(repl, text)


def _remove_invalid_escape_backslashes(text: str) -> str:
    """Strip the backslash from invalid escape sequences."""
    return INVALID_ESCAPE_RE.sub(lambda match: match.group(1), text)



def _double_escape_invalid_sequences(text: str) -> str:
    """Replace invalid escape sequences with double backslashes."""
    return INVALID_ESCAPE_RE.sub(lambda match: "\\\\" + match.group(1), text)

def _dict_has_required_fields(value: Any) -> bool:
    return isinstance(value, dict) and "verdict" in value and "details" in value


def _report_dict_has_required_fields(value: Any) -> bool:
    return isinstance(value, dict) and "vulnerability_title" in value and "location" in value

def _find_outmost_json_objects(text: str) -> List[str]:
    """Extract top-level JSON object substrings from mixed content."""
    results: List[str] = []
    depth = 0
    in_string = False
    escape = False
    start_idx: Optional[int] = None

    for idx, ch in enumerate(text):
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            if depth == 0:
                start_idx = idx
            depth += 1
        elif ch == "}" and depth > 0:
            depth -= 1
            if depth == 0 and start_idx is not None:
                results.append(text[start_idx : idx + 1])
                start_idx = None
    return results


def _extract_candidate_jsons(text: str) -> List[str]:
    """Return possible JSON snippets (dicts) extracted from text."""
    candidates: List[str] = []
    stripped = text.strip()
    try:
        parsed = json.loads(stripped)
    except Exception:
        parsed = None

    if isinstance(parsed, dict):
        if _dict_has_required_fields(parsed):
            candidates.append(stripped)
        return candidates
    if isinstance(parsed, list):
        for item in parsed:
            if _dict_has_required_fields(item):
                candidates.append(json.dumps(item, ensure_ascii=False))
        if candidates:
            return candidates

    objects = _find_outmost_json_objects(text)
    for obj in objects:
        try:
            loaded = json.loads(obj)
        except Exception:
            continue
        if _dict_has_required_fields(loaded):
            candidates.append(obj)
    return candidates


def _coerce_report_payload(raw: Any) -> Optional[str]:
    """Pick a likely report dict from mixed/list payloads and return as JSON string."""
    def _select_from_list(items: list[Any]) -> Optional[str]:
        for item in items:
            if _report_dict_has_required_fields(item):
                try:
                    return json.dumps(item, ensure_ascii=False)
                except Exception:
                    return str(item)
        return None

    # Already a dict
    if _report_dict_has_required_fields(raw):
        try:
            return json.dumps(raw, ensure_ascii=False)
        except Exception:
            return str(raw)
    # List of candidates
    if isinstance(raw, list):
        selected = _select_from_list(raw)
        if selected:
            return selected
    # String that might be JSON
    if isinstance(raw, str):
        try:
            loaded = json.loads(raw)
        except Exception:
            loaded = None
        if loaded is not None:
            if _report_dict_has_required_fields(loaded):
                return json.dumps(loaded, ensure_ascii=False)
            if isinstance(loaded, list):
                selected = _select_from_list(loaded)
                if selected:
                    return selected
    return None

CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*([\s\S]*?)\s*```$", re.MULTILINE)
JSON_FENCE_RE = re.compile(r"```json\s*([\s\S]*?)```", re.IGNORECASE)
def _strip_code_fences(text: str) -> str:
    stripped = text.strip()
    json_match = JSON_FENCE_RE.findall(stripped)
    if json_match:
        return json_match[-1]
    m = CODE_FENCE_RE.search(stripped)
    return m.group(1) if m else text


def _parse_with_escape_repair(parser: PydanticOutputParser, text: str) -> BaseModel:
    """Attempt structured parse with layered escape repairs."""
    text = _unwrap_tool_envelope(text)
    text = _strip_code_fences(text)
    attempts = [text]
    escaped_backticks = _escape_quotes_in_backticks(text)
    if escaped_backticks != text:
        attempts.append(escaped_backticks)
    removed = _remove_invalid_escape_backslashes(text)
    if removed != text and removed not in attempts:
        attempts.append(removed)
    doubled = _double_escape_invalid_sequences(text)
    if doubled != text and doubled not in attempts:
        attempts.append(doubled)

    tried: set[str] = set()
    last_error: Exception | None = None
    for candidate in attempts:
        if candidate in tried:
            continue
        tried.add(candidate)
        try:
            return parser.parse(candidate)
        except Exception as exc:
            last_error = exc

    for candidate in list(tried):
        for payload in _extract_candidate_jsons(candidate):
            payload_stripped = payload.strip()
            if not payload_stripped or payload_stripped in tried:
                continue
            tried.add(payload_stripped)
            try:
                return parser.parse(payload_stripped)
            except Exception as exc:
                last_error = exc

    for candidate in list(tried):
        try:
            repaired = repair_json(candidate)
        except Exception:
            continue
        if repaired in tried:
            continue
        tried.add(repaired)
        try:
            return parser.parse(repaired)
        except Exception as exc:
            last_error = exc

    if last_error is not None:
        raise last_error
    raise ValueError("Parser repair attempts failed unexpectedly")


def _coerce_line_range(value: Any) -> Optional[str]:
    if value in (None, ""):
        return None
    if isinstance(value, list) and len(value) == 2:
        start, end = value
        if start == end:
            return str(start)
        return f"{start}-{end}"
    return str(value)



def _append_error(state: GraphState, message: str) -> GraphState:
    errors = list(state.get("errors") or [])
    errors.append(message)
    return {**state, "errors": errors}


def _coerce_optional_str(value: Any, fallback: Any = None) -> Optional[str]:
    """Normalize various ID types to optional strings."""
    candidate = value if value not in (None, "") else fallback
    if candidate in (None, ""):
        return None
    return str(candidate)


def build_select_batch_node(batch_size: int):
    def node(state: GraphState) -> GraphState:
        queue = list(state.get("queue") or [])
        if not queue:
            log_progress("처리할 시드가 없어 이번 배치는 종료됩니다.")
            return {**state, "batch": [], "batch_index": 0, "finding": None}
        batch = queue[:batch_size]
        remaining = queue[batch_size:]
        log_progress(f"시드 {len(batch)}건 배치 준비(잔여 {len(remaining)}건)")
        return {
            **state,
            "queue": remaining,
            "batch": batch,
            "batch_index": 0,
            "finding": None,
        }

    return node

def build_load_finding_node():
    def node(state: GraphState) -> GraphState:
        batch = state.get("batch") or []
        index = int(state.get("batch_index") or 0)
        if index >= len(batch):
            return {**state, "finding": None}
        finding = batch[index]
        log_progress(
            f"분류 진행: 시드 {finding.get('id', 'unknown')} (배치 {index + 1}/{len(batch)})"
        )
        next_state = dict(state)
        next_state["batch_index"] = index + 1
        next_state["finding"] = finding
        return next_state

    return node

def route_batch(state: GraphState) -> str:
    batch = state.get("batch") or []
    return "process" if batch else "done"


def route_finding(state: GraphState) -> str:
    finding = state.get("finding")
    return "process" if finding else "next_batch"


def store_results_node(state: GraphState) -> GraphState:
    classification = state.get("classification")
    classifications = list(state.get("classifications") or [])
    report = state.get("report")
    reports = list(state.get("reports") or [])

    if classification:
        classifications.append(cast(ClassificationResult, classification))

    if report and classification:
        # Only store report when it matches the current true_positive classification
        if (
            str(report.get("id")) == str(classification.get("id"))
            and classification.get("verdict") == "true_positive"
        ):
            reports.append(report)
    elif report:
        # If classification is missing, ignore stray report
        log_progress("분류 없이 전달된 리포트가 있어 무시합니다.")
    if report and not reports:
        # If the report was ignored due to mismatch, make it clear in logs
        log_progress("리포트가 분류와 매칭되지 않아 저장하지 않습니다.")
        reports.append(report)

    updated = dict(state)
    updated["classifications"] = classifications
    updated["reports"] = reports
    updated.pop("classification", None)
    updated.pop("report", None)
    error_count = len(updated.get("errors") or [])
    log_progress(
        f"진행 상황: 분류 {len(classifications)}건, 오류 {error_count}건"
    )
    return updated


def _stringify_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        fragments: List[str] = []
        for chunk in content:
            if isinstance(chunk, dict):
                # Prefer explicit text field
                if "text" in chunk:
                    fragments.append(str(chunk.get("text", "")))
                    continue
                # Skip reasoning/metadata blobs that aren't display text
                if chunk.get("type") == "reasoning":
                    continue
            fragments.append(str(chunk))
        return "\n".join(fragments)
    return json.dumps(content, ensure_ascii=False)


def _unwrap_tool_envelope(text: str) -> str:
    stripped = text.strip()
    if not (stripped.startswith("{") and stripped.endswith("}")):
        return text
    try:
        payload = json.loads(stripped)
    except Exception:
        return text
    if isinstance(payload, dict) and payload.get("type") == "tool" and "content" in payload:
        inner = payload["content"]
        if isinstance(inner, str):
            return inner
        return _stringify_content(inner)
    return text


def _extract_json_tool_payload(records: Sequence[Dict[str, Any]]) -> Optional[str]:
    for record in reversed(records):
        if record.get("tool") != JSON_TOOL_NAME:
            continue
        response = record.get("response")
        if isinstance(response, str) and response.strip():
            return response
        if response not in (None, ""):
            try:
                return json.dumps(response, ensure_ascii=False)
            except Exception:
                pass
        args = record.get("args")
        if isinstance(args, str) and args.strip():
            return args
    return None


def extract_agent_output(raw: Any) -> str:
    """Normalise various LangChain agent return types to a string."""
    if raw is None:
        return ""
    if isinstance(raw, dict):
        output = raw.get("output")
        extracted = _extract_dict_content(output)
        if extracted:
            return extracted
        if isinstance(output, str) and output.strip():
            return output
        output_text = raw.get("output_text")
        extracted = _extract_dict_content(output_text)
        if extracted:
            return extracted
        if isinstance(output_text, str) and output_text.strip():
            return output_text
        messages = raw.get("messages")
        if isinstance(messages, list) and messages:
            for message in reversed(messages):
                if isinstance(message, (AIMessage, ToolMessage)):
                    text = _stringify_content(message.content)
                    if text.strip():
                        return text
            return str(messages[-1])
    if isinstance(raw, AIMessage):
        return _stringify_content(raw.content)
    if isinstance(raw, ToolMessage):
        return _stringify_content(raw.content)
    # Fallback returns empty string (caller handles missing output)
    return ""


# ---------------------------------------------------------------------------
# Tool usage logging
# ---------------------------------------------------------------------------
class ToolCallLogger(BaseCallbackHandler):
    """Collect tool inputs and outputs during agent execution."""

    def __init__(self, *, stage: str = "") -> None:
        self._active: Dict[str, Dict[str, Any]] = {}
        self.records: List[Dict[str, Any]] = []
        self._stage = stage

    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        *,
        run_id: str,
        **kwargs: Any,
    ) -> None:
        self._active[run_id] = {
            "tool": serialized.get("name", "unknown"),
            "args": input_str,
            "timestamp": datetime.now(UTC).isoformat(),
        }

    def on_tool_end(
        self,
        output: str,
        *,
        run_id: str,
        **kwargs: Any,
    ) -> None:
        entry = self._active.pop(run_id, {"tool": "unknown", "args": "", "timestamp": ""})
        entry["response"] = make_json_safe(output)
        if self._stage:
            entry["stage"] = self._stage
        self.records.append(entry)

    def usage_by_tool(self) -> Dict[str, List[Dict[str, Any]]]:
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for item in self.records:
            tool = item["tool"]
            if tool == JSON_TOOL_NAME:
                continue
            grouped.setdefault(tool, []).append(
                {
                    "args": item.get("args", ""),
                    "response": item.get("response", ""),
                    "timestamp": item.get("timestamp", ""),
                }
            )
        return grouped


# ---------------------------------------------------------------------------
# LLM builders
# ---------------------------------------------------------------------------
def build_llm() -> Any:
    """Instantiate the configured chat model."""
    kwargs = {
        "model": CONFIG.model_name,
        "temperature": CONFIG.temperature, 
        #"top_p": CONFIG.top_p
        }
    
    if CONFIG.llm_provider == "groq":
        return ChatGroq(**kwargs)
    if CONFIG.llm_provider == "openai":
        return ChatOpenAI(**kwargs)
    if CONFIG.llm_provider == "openrouter":
        if CONFIG.model_name == "deepseek/deepseek-v3.2-exp" or CONFIG.model_name == "x-ai/grok-4.1-fast" or CONFIG.model_name == "deepseek/deepseek-chat-v3.1":
            return ChatOpenAI(**kwargs, base_url="https://openrouter.ai/api/v1", api_key=CONFIG.openrouter_api_key, reasoning={"enabled": True})
        return ChatOpenAI(**kwargs, base_url="https://openrouter.ai/api/v1", api_key=CONFIG.openrouter_api_key)
    if CONFIG.llm_provider == "anthropic":
        return ChatAnthropic(**kwargs)
    raise ValueError(f"Unsupported LLM provider: {CONFIG.llm_provider}")


def maybe_attach_json_tool(tools: List[Any]) -> List[Any]:
    if not JSON_TOOL_ENABLED:
        return tools
    for tool in tools:
        if getattr(tool, "name", "").lower() == JSON_TOOL_NAME:
            return tools
    extended = list(tools)
    extended.append(JsonRelayTool())
    log_progress("JSON pass-through tool 활성화")
    return extended


# ---------------------------------------------------------------------------
# Agent prompts
# ---------------------------------------------------------------------------



PRIMARY_SYSTEM_PROMPT_TEMPLATE = (
    "You are a security analyst validating SARIF findings. "
    "Each finding contains `vulnerability_info`, `sink`, optional `source`, and `taint_flow`. "
    "You must decide whether it is a true or false positive and then output exactly one JSON object "
    "containing the fields `id`, `verdict`, `details`, and optional `notes`. "
    "`verdict` must be `true_positive` or `false_positive`, `details` must summarise the supporting evidence, "
    "and no extra commentary is allowed outside the JSON block.\n\n"
    # "## AVAILABLE TOOLS\n"
    # "- `read_source(path, line, before, after)`\n"
    # "- `read_definition(symbol, file, include_body)`\n"
    # "- `find_references(symbol_or_pattern, dir, max_results)`\n\n"
    # "When you need a tool, you MUST call it using JSON exactly like these examples:\n"
    # "{{\n"
    # '  "tool": "read_source",\n'
    # '  "arguments": {{\n'
    # '    "path": "src/main/java/foo/Bar.java",\n'
    # '    "line": 42,\n'
    # '    "before": 5,\n'
    # '    "after": 5\n'
    # "  }}\n"
    # "}}\n"
    # "{{\n"
    # '  "tool": "read_definition",\n'
    # '  "arguments": {{\n'
    # '    "symbol": "spark.Response.addCookie",\n'
    # '    "file": "src/main/java/spark/Response.java",\n'
    # '    "include_body": true\n'
    # "  }}\n"
    # "}}\n"
    # "{{\n"
    # '  "tool": "find_references",\n'
    # '  "arguments": {{\n'
    # '    "symbol_or_pattern": "addCookie",\n'
    # '    "dir": "src/main/java",\n'
    # '    "max_results": 20\n'
    # "  }}\n"
    # "}}\n"
    "{format_instructions}"
)






PRIMARY_SYSTEM_PROMPT = PRIMARY_SYSTEM_PROMPT_TEMPLATE.format(
    format_instructions=PRIMARY_OUTPUT_PARSER.get_format_instructions()
)


# ---------------------------------------------------------------------------
# Prompt helpers
# ---------------------------------------------------------------------------
def render_finding_for_prompt(finding: SeedFinding) -> str:
    """Convert the structured seed finding into a readable prompt snippet."""
    sink = finding.get("sink") or finding.get("vulnerable_sink") or {}
    sources_raw: Any = finding.get("source") or finding.get("vulnerable_source") or []
    taint_flows: Any = finding.get("taint_flow") or []

    def fmt_line_range(value: Any) -> str:
        if isinstance(value, list) and len(value) == 2:
            start, end = value
            if start == end:
                return str(start)
            return f"{start}-{end}"
        return str(value or "N/A")

    if isinstance(sources_raw, dict):
        sources = [sources_raw]
    elif isinstance(sources_raw, list):
        sources = [item for item in sources_raw if isinstance(item, dict)]
    else:
        sources = []

    parts = [
        f"ID: {finding.get('id', 'unknown')}",
        f"Summary: {finding.get('vulnerability_info', 'N/A')}",
        "Suspected sink:",
        f"  - file: {sink.get('file_path', 'N/A')}",
        f"  - lines: {fmt_line_range(sink.get('line_range'))}",
    ]

    if sources:
        parts.append("Potential sources:")
        for source in sources:
            line_range = source.get("line_range")
            line_value = (
                fmt_line_range(line_range)
                if line_range
                else source.get("line") or "N/A"
            )
            note = source.get("note") or source.get("code_snippet") or source.get("label") or ""
            parts.append(
                f"  - id={source.get('id', '?')} file={source.get('file_path', 'N/A')} "
                f"lines={line_value} note={note}"
            )

    # Normalise taint flows: parser may return list of lists or flat list
    def iter_flows(raw: Any) -> Iterable[Sequence[Dict[str, Any]]]:
        if isinstance(raw, list):
            for item in raw:
                if isinstance(item, list):
                    yield [step for step in item if isinstance(step, dict)]
                elif isinstance(item, dict):
                    yield [item]

    flattened_flows = list(flow for flow in iter_flows(taint_flows) if flow)
    if flattened_flows:
        parts.append("Taint flow steps:")
        multiple_paths = len(flattened_flows) > 1
        for path_idx, flow in enumerate(flattened_flows, start=1):
            if multiple_paths:
                parts.append(f"  Path {path_idx}:")
            for step in flow:
                snippet = step.get("code_snippet") or step.get("note") or step.get("label") or ""
                parts.append(
                    f"    - step={step.get('step', '?')} "
                    f"{step.get('file_path', 'N/A')}:{step.get('line', 'N/A')} "
                    f"{snippet}"
                )

    return "\n".join(parts)


def _summarise_taint_flow(finding: SeedFinding) -> Dict[str, Any]:
    """Pick a representative path from taint_flow for reporting/prompting."""
    taint_flows = finding.get("taint_flow") or []
    paths: List[List[Dict[str, Any]]] = []
    if isinstance(taint_flows, list):
        for item in taint_flows:
            if isinstance(item, list):
                paths.append([step for step in item if isinstance(step, dict)])
            elif isinstance(item, dict):
                paths.append([item])
    first_path = paths[0] if paths else []

    source_node: Optional[Dict[str, Any]] = first_path[0] if first_path else None
    if source_node is None:
        sources_raw = finding.get("source") or finding.get("vulnerable_source")
        if isinstance(sources_raw, dict):
            source_node = sources_raw
        elif isinstance(sources_raw, list) and sources_raw:
            first = sources_raw[0]
            if isinstance(first, dict):
                source_node = first
    propagation_nodes = first_path[1:] if len(first_path) > 1 else []

    return {
        "source": source_node or None,
        "propagation": propagation_nodes or None,
        "sink": finding.get("sink") or None,
    }


def _build_report_prompt(finding: SeedFinding, classification: ClassificationResult) -> str:
    sink = finding.get("sink") or {}
    location = {
        "file_path": sink.get("file_path", ""),
        "line_number": _coerce_line_range(sink.get("line_range")) or "",
    }

    taint_summary = _summarise_taint_flow(finding)
    source = taint_summary.get("source")
    source_lines = ""
    if source:
        source_lines = (
            f"{source.get('file_path', '')}:{source.get('line', '')} "
            f"{source.get('code_snippet', '') or source.get('note', '') or ''}"
        )
    propagation = taint_summary.get("propagation") or []
    propagation_lines = [
        f"{item.get('file_path', '')}:{item.get('line', '')} "
        f"{item.get('code_snippet', '') or item.get('note', '') or ''}"
        for item in propagation
    ]

    sink_line = f"{sink.get('file_path', '')}:{_coerce_line_range(sink.get('line_range')) or ''}"
    desc_raw = classification.get("details", "")
    if isinstance(desc_raw, str):
        description = desc_raw
    else:
        try:
            description = json.dumps(desc_raw, ensure_ascii=False)
        except Exception:
            description = str(desc_raw)

    return "\n".join(
        [
            f"ID: {finding.get('id', '')}",
            f"Vulnerability info: {finding.get('vulnerability_info', '')}",
            f"Location (sink): {sink_line}",
            f"Source (from taint flow if any): {source_lines or 'N/A'}",
            "Propagation (sampled from taint flow):",
            *(propagation_lines or ["N/A"]),
            f"Classification details: {description}",
            "Task: Produce a concise vulnerability report JSON with the requested fields.",
        ]
    )


REPORT_SYSTEM_PROMPT_TEMPLATE = (
    "You are a security report writer with access to source browsing tools. "
    "Given a SARIF-like finding and its classification, generate a JSON report with the following keys: "
    "`id`, `vulnerability_title`, `severity`, `cwe`, `location{{file_path,line_number}}`, "
    "`description`, `taint_flow_analysis{{source, propagation(optional), sink}}`, "
    "`proof_of_concept{{scenario, example}}`, `recommendation{{how_to_fix, code_example_fix}}`, "
    "`code_fix_patch{{target_file, line_range, original_snippet, modified_snippet, notes}}`, "
    "`functional_test{{description, framework, dependencies, file_path, setup_commands, command, script}}`, "
    "`security_regression_test{{description, framework, dependencies, file_path, setup_commands, command, script}}`. "
    "functional_test should explain how normal behavior is validated, choose an appropriate test framework, "
    "list dependencies, and provide a concrete command and (if needed) full test script; "
    "security_regression_test should explain how the exploit is blocked, with its own command and script suited to the attack scenario. "
    "If information is missing, leave empty strings or nulls. "
    "Reconstruct taint_flow_analysis concisely; do not list dozens of steps—choose the critical ones. "
    "Use tools to read code if needed, but do not add extra fields. "
    "{format_instructions}"
)

# ---------------------------------------------------------------------------
# Core processing
# ---------------------------------------------------------------------------
def build_classification_node(agent: Any, report_agent: Any):
    async def node(state: GraphState) -> GraphState:
        finding = state["finding"]
        message = HumanMessage(
            content=(
                "Classify the following finding:\n"
                f"{render_finding_for_prompt(finding)}"
            )
        )

        last_error: Optional[str] = None
        max_retries = CONFIG.max_classification_attempts
        for attempt in range(0, max_retries + 1):
            is_retry = attempt > 0
            retry_label = (
                f"재시도 {attempt}/{max_retries}" if is_retry else "초기 시도"
            )
            logger = ToolCallLogger(stage="classification")
            try:
                raw = await agent.ainvoke({"messages": [message]}, config={"callbacks": [logger]})
            except Exception as exc:
                last_error = f"시드 {finding.get('id', 'unknown')} 분류 호출 실패 ({retry_label}): {exc}"
                log_progress(last_error)
                if attempt == max_retries:
                    state = _append_error(state, last_error)
                    parsed = {
                        "id": _coerce_optional_str(None, finding.get("id")) or "",
                        "verdict": "error",
                        "details": "LLM 호출이 실패했습니다.",
                        "notes": {"error": str(exc)},
                    }
                    return {**state, "classification": parsed}
                continue

            json_payload = _extract_json_tool_payload(logger.records)
            output_text = json_payload or extract_agent_output(raw)

            if not output_text:
                last_error = (
                    f"시드 {finding.get('id', 'unknown')} 분류 실패: 응답이 비었습니다. "
                    f"({retry_label})"
                )
                log_progress(last_error)
                if attempt == max_retries:
                    state = _append_error(state, last_error)
                    parsed = {
                        "id": _coerce_optional_str(None, finding.get("id")) or "",
                        "verdict": "error",
                        "details": "LLM 응답이 비어 있어 분류를 수행하지 못했습니다.",
                        "notes": {"raw_output": output_text},
                    }
                    return {**state, "classification": parsed}
                continue

            try:
                parsed_model = _parse_with_escape_repair(PRIMARY_OUTPUT_PARSER, output_text)
                parsed = _model_to_dict(parsed_model)
            except Exception as exc:
                last_error = (
                    f"시드 {finding.get('id', 'unknown')} 분류 실패: {exc} "
                    f"({retry_label})"
                )
                log_progress(last_error)
                if attempt == max_retries:
                    state = _append_error(state, last_error)
                    parsed = {
                        "id": _coerce_optional_str(None, finding.get("id")) or "",
                        "verdict": "error",
                        "details": "LLM JSON 파싱이 실패했습니다.",
                        "notes": {"error": str(exc), "raw_output": output_text},
                    }
                    return {**state, "classification": parsed}
                continue

            coerced_id = _coerce_optional_str(parsed.get("id"), finding.get("id"))
            if coerced_id is None:
                coerced_id = str(finding.get("id", ""))
            parsed["id"] = coerced_id
            if INCLUDE_TOOL_USAGE:
                parsed.setdefault("tool_usage", {})
                parsed["tool_usage"].update(logger.usage_by_tool())

            report: Optional[Dict[str, Any]] = None
            if parsed.get("verdict") == "true_positive":
                log_progress(f"리포트 생성 시작: 시드 {coerced_id}")
                report = await generate_report(report_agent, finding, parsed)

            log_progress(
                f"분류 완료: 시드 {coerced_id} → {parsed.get('verdict', 'unknown')}"
            )
            next_state = {**state, "classification": parsed}
            if report is not None:
                next_state["report"] = report
            return next_state

        # Should not reach here due to returns in loop, but keep fallback.
        fallback = {
            "id": _coerce_optional_str(None, finding.get("id")) or "",
            "verdict": "error",
            "details": "LLM 호출이 반복적으로 실패했습니다.",
            "notes": {"error": last_error or "unknown"},
        }
        state = _append_error(state, fallback["details"])
        return {**state, "classification": fallback}

    return node


async def generate_report(
    report_agent: Any,
    finding: SeedFinding,
    classification: ClassificationResult,
) -> Dict[str, Any]:
    """Call report agent (with MCP tools) to build a structured report for a true_positive finding."""
    prompt_text = _build_report_prompt(finding, classification)
    messages = [
        HumanMessage(content=prompt_text),
    ]
    logger = ToolCallLogger(stage="report")
    model_dict: Dict[str, Any]
    last_error: Exception | None = None
    try:
        raw = await report_agent.ainvoke({"messages": messages}, config={"callbacks": [logger]})
        json_payload = _extract_json_tool_payload(logger.records)
        output_text = json_payload or extract_agent_output(raw)
        coerced = _coerce_report_payload(output_text)
        if coerced is not None:
            output_text = coerced
        parsed_model = _parse_with_escape_repair(REPORT_OUTPUT_PARSER, output_text)
        model_dict = _model_to_dict(parsed_model)
        log_progress(f"리포트 생성 성공: 시드 {finding.get('id', 'unknown')}")
    except Exception as exc:
        last_error = exc
        log_progress(f"리포트 생성 에이전트 호출 실패, 기본값으로 대체: {exc}")
        model_dict = {}

    # Fill defaults and guaranteed fields
    taint_summary = _summarise_taint_flow(finding)
    sink_fallback = finding.get("sink") or {}

    def _node_from_entry(entry: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(entry, dict):
            return None
        line_number = _coerce_line_range(entry.get("line_range")) or entry.get("line")
        node: Dict[str, Any] = {
            "file_path": entry.get("file_path", ""),
            "line_number": line_number or "",
        }
        if entry.get("code_snippet"):
            node["code_snippet"] = entry.get("code_snippet")
        if entry.get("note"):
            node["explanation"] = entry.get("note")
        return node

    sink = finding.get("sink") or {}
    location = model_dict.get("location") or {}
    if not isinstance(location, dict):
        location = {}
    location.setdefault("file_path", sink.get("file_path", ""))
    location.setdefault("line_number", _coerce_line_range(sink.get("line_range")) or "")
    model_dict["location"] = location

    # Provide default taint_flow_analysis from seed (including code_snippet) if missing
    model_dict.setdefault("taint_flow_analysis", {})
    tfa = model_dict["taint_flow_analysis"]
    if not isinstance(tfa, dict):
        tfa = {}
    if not tfa.get("source"):
        tfa["source"] = _node_from_entry(taint_summary.get("source"))
    if not tfa.get("propagation"):
        propagation_nodes = []
        for entry in taint_summary.get("propagation") or []:
            node = _node_from_entry(entry)
            if node:
                propagation_nodes.append(node)
        if propagation_nodes:
            tfa["propagation"] = propagation_nodes
    if not tfa.get("sink"):
        tfa["sink"] = _node_from_entry(taint_summary.get("sink") or sink_fallback)
    model_dict["taint_flow_analysis"] = tfa

    model_dict.setdefault("description", classification.get("details", ""))
    model_dict["id"] = _coerce_optional_str(model_dict.get("id"), finding.get("id")) or finding.get("id", "")

    # Ensure nested keys exist even if empty
    model_dict.setdefault("proof_of_concept", {})
    model_dict.setdefault("recommendation", {})
    model_dict.setdefault("code_fix_patch", {})
    model_dict.setdefault("functional_test", {})
    model_dict.setdefault("security_regression_test", {})

    return model_dict




# ---------------------------------------------------------------------------
# CLI arguments and overrides
# ---------------------------------------------------------------------------
def parse_cli_args():
    parser = argparse.ArgumentParser(description="Classify SARIF findings with LLM + MCP tools")
    parser.add_argument("--input-seed-file", required=True, help="Path to SARIF seed JSON file")
    parser.add_argument("--provider", required=True, help="LLM provider (groq, openai, openrouter, etc.)")
    parser.add_argument("--model", required=True, help="LLM model name")
    parser.add_argument("--project", required=True, help="Project name (used for output file naming)")
    parser.add_argument("--mcp-url", required=False, help="Override MCP server URL")
    parser.add_argument("--no-langsmith", action="store_true", help="Disable LangSmith tracing")
    return parser.parse_args()


def apply_cli_overrides(args):
    global CONFIG, JSON_TOOL_ENABLED, INCLUDE_TOOL_USAGE
    CONFIG.seed_path = Path(args.input_seed_file)
    CONFIG.llm_provider = args.provider.lower()
    CONFIG.model_name = args.model
    CONFIG.project_title = args.project
    if args.mcp_url:
        CONFIG.mcp_url = args.mcp_url
    CONFIG.validate()
    JSON_TOOL_ENABLED = CONFIG.should_enable_json_tool()
    INCLUDE_TOOL_USAGE = CONFIG.should_include_tool_usage()


def maybe_enable_langsmith(disabled: bool):
    if disabled:
        print("LangSmith disabled via --no-langsmith")
        return
    if not os.getenv("LANGCHAIN_API_KEY"):
        print("LangSmith not configured (LANGCHAIN_API_KEY missing)")
        return
    try:
        project_name = CONFIG.project_title or "sarif_model_check"
        logging.langsmith(project_name)
        print(f"LangSmith tracing enabled (project: {project_name})")
    except Exception as exc:
        print(f"LangSmith setup failed: {exc}")


async def run_pipeline() -> PipelineResult:
    """Entry point that wires MCP tools, agents, and batch processing together."""
    seeds = load_seed_file(CONFIG.seed_path)
    llm = build_llm()
    project_slug = re.sub(r"[^A-Za-z0-9._-]", "_", CONFIG.project_title or "project")

    connection = {"transport": "streamable_http", "url": CONFIG.mcp_url}
    async with create_session(connection) as session:
        await session.initialize()
        tools = await load_mcp_tools(session)
        tools = maybe_attach_json_tool(tools)

        # `search_for_pattern` 호출은 정규식 질문에 Groq 400 오류가 발생하므로 주의.
        # tools = [tool for tool in tools if getattr(tool, "name", "") != "search_for_pattern"]

        primary_agent = create_agent(llm, tools=tools, system_prompt=PRIMARY_SYSTEM_PROMPT)
        report_agent = create_agent(llm, tools=tools, system_prompt=REPORT_SYSTEM_PROMPT_TEMPLATE.format(
            format_instructions=REPORT_OUTPUT_PARSER.get_format_instructions()
        ))

        graph = StateGraph(GraphState)
        graph.add_node("select_batch", build_select_batch_node(CONFIG.batch_size))
        graph.add_node("load_finding", build_load_finding_node())
        graph.add_node("classify", build_classification_node(primary_agent, report_agent))
        graph.add_node("store_results", store_results_node)

        graph.set_entry_point("select_batch")
        graph.add_conditional_edges("select_batch", route_batch, {"process": "load_finding", "done": END})
        graph.add_conditional_edges("load_finding", route_finding, {"process": "classify", "next_batch": "select_batch"})
        graph.add_edge("classify", "store_results")
        graph.add_edge("store_results", "load_finding")

        workflow = graph.compile()

        initial_state: GraphState = {
            "queue": list(seeds),
            "batch": [],
            "batch_index": 0,
            "classifications": [],
            "reports": [],
            "errors": [],
        }

        final_state: GraphState = await workflow.ainvoke(
            initial_state, config={"recursion_limit": max(1000, len(seeds) * 10)}
        )

    all_classifications = list(final_state.get("classifications") or [])
    all_reports = list(final_state.get("reports") or [])
    errors_list = list(final_state.get("errors") or [])

    analysis_dir = Path("results")
    analysis_dir.mkdir(parents=True, exist_ok=True)
    analysis_path = analysis_dir / f"{project_slug}_latest.json"
    report_path = analysis_dir / f"{project_slug}_report_latest.json"

    verdict_counts: Dict[str, int] = {'true_positive': 0, 'false_positive': 0, 'error': 0, 'other': 0}
    for item in all_classifications:
        verdict = str(item.get("verdict", "other"))
        if verdict not in verdict_counts:
            verdict_counts['other'] += 1
        else:
            verdict_counts[verdict] += 1

    log_progress('분류 요약:')
    log_progress(
        f"  - true_positive: {verdict_counts['true_positive']}건 false_positive: {verdict_counts['false_positive']}건 오류: {verdict_counts['error']}건"
    )
    if errors_list:
        log_progress(f'오류 발생: {len(errors_list)}건(세부 내용은 결과 파일 참조)')

    result = {
        'classifications': all_classifications,
        'analysis_file': str(analysis_path),
        'report_file': str(report_path),
        'errors': errors_list,
        'summary': {
            'verdict_counts': verdict_counts,
            'error_count': len(errors_list),
        },
    }

    with analysis_path.open("w", encoding="utf-8") as fp:
        json.dump(result, fp, ensure_ascii=False, indent=2)
    with report_path.open("w", encoding="utf-8") as fp:
        json.dump(all_reports, fp, ensure_ascii=False, indent=2)

    log_progress(f"총 {len(all_classifications)}건 분류 결과 정리")
    log_progress(f"분석 결과 저장: {analysis_path}")
    log_progress(f"리포트 저장: {report_path}")

    return result


def main() -> None:
    """Run the async pipeline and print the aggregated results as JSON."""
    args = parse_cli_args()
    apply_cli_overrides(args)
    maybe_enable_langsmith(disabled=args.no_langsmith)

    result = asyncio.run(run_pipeline())
    classifications = result.get("classifications", [])
    print("[분류 요약]")
    for entry in classifications:
        cid = entry.get("id", "unknown")
        verdict = entry.get("verdict", "unknown")
        print(f"- id={cid} verdict={verdict}")
    print(f"총 {len(classifications)}건 처리, 상세는 {result.get('analysis_file', '')} 파일 참조")
    report_file = result.get("report_file", "")
    if report_file:
        print(f"리포트 파일: {report_file}")


if __name__ == "__main__":
    main()
