"""
MCP 서버 메인 파일
"""

from __future__ import annotations

import hashlib
from typing import List, Optional, TypedDict
from mcp.server.fastmcp import FastMCP, Context
from dotenv import load_dotenv
load_dotenv()
import sys, logging # stdio 모드를 위함

from config import (
    REPO_ROOT, REPO_REV, # STDIO에선 HOST/PORT 불필요
    MAX_BYTES, DEFAULT_BEFORE, DEFAULT_AFTER, MAX_BEFORE, MAX_AFTER,
    DEFAULT_MAX_RESULTS, HARD_MAX_RESULTS, is_allowed_path, has_allowed_ext
)
from indexer import CTagsIndex, find_references_with_ripgrep, detect_function_bounds, clamp

mcp = FastMCP("code-index-mcp", instructions=(
    "Tools for precise code browsing. Always use read_definition / find_references / read_source instead of asking for whole files.\n"
    "Return concise results; avoid flooding the client. Use max_results and truncation."
))

ctags_index: CTagsIndex | None = None
# STDIO에서는 stdout에 임의 텍스트를 쓰면 안 됨. 로깅은 stderr로
logging.basicConfig(stream=sys.stderr, level=logging.INFO)

def initialize_index():
    """서버 시작 시 ctags 인덱스 초기화 및 빌드"""
    global ctags_index
    ctags_index = CTagsIndex(REPO_ROOT)
    logging.info(f"Building ctags index for {REPO_ROOT}")
    ctags_index.build()
    logging.info("ctags index built.")

class ReferenceItem(TypedDict):
    file: str
    line: int
    snippet: str

class FindReferencesResponse(TypedDict):
    repo: str
    rev: str | None
    references: List[ReferenceItem]
    total: int
    truncated: bool

class ReadSourceResponse(TypedDict):
    repo: str
    rev: str | None
    path: str
    start_line: int
    end_line: int
    text: str | None
    truncated: bool
    sha256: str | None

class DefinitionResponse(TypedDict):
    repo: str
    rev: str | None
    symbol: str
    results: List[dict]

@mcp.tool()
def find_references(symbol_or_pattern: str, dir: Optional[str] = REPO_ROOT, max_results: int = DEFAULT_MAX_RESULTS) -> FindReferencesResponse:
    """심볼이나 패턴의 참조를 ripgrep으로 검색"""
    refs, total = find_references_with_ripgrep(symbol_or_pattern, dir, max_results)
    truncated = total > len(refs)
    return {
        "repo": str(REPO_ROOT),
        "rev": REPO_REV,
        "references": [ {"file": r.file, "line": r.line, "snippet": r.snippet} for r in refs ],
        "total": total,
        "truncated": truncated
    }

@mcp.tool()
def read_source(path: str, line: int, before: int = DEFAULT_BEFORE, after: int = DEFAULT_AFTER) -> ReadSourceResponse:
    """지정된 라인 주변의 소스 코드를 읽어옴"""
    from pathlib import Path
    p = (REPO_ROOT / path).resolve()
    if not (is_allowed_path(p) and has_allowed_ext(p)):
        raise ValueError("Path not allowed")
    before = clamp(before, 0, MAX_BEFORE)
    after = clamp(after, 0, MAX_AFTER)

    lines = p.read_text(errors="ignore").splitlines()
    start = max(1, line - before)
    end = min(len(lines), line + after)
    snippet_lines = lines[start-1:end]
    text = "\n".join(snippet_lines)
    truncated = False
    if len(text.encode("utf-8")) > MAX_BYTES:
        half = MAX_BYTES // 2
        head = text.encode("utf-8")[:half]
        tail = text.encode("utf-8")[-half:]
        text = head.decode("utf-8", errors="ignore") + "\n...\n" + tail.decode("utf-8", errors="ignore")
        truncated = True
    sha256 = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return {
        "repo": str(REPO_ROOT),
        "rev": REPO_REV,
        "path": str(p.relative_to(REPO_ROOT)),
        "start_line": start,
        "end_line": end,
        "text": text,
        "truncated": truncated,
        "sha256": sha256,
    }

@mcp.tool()
def read_definition(symbol: str, file: Optional[str] = None, language: Optional[str] = None, include_body: bool = True) -> DefinitionResponse:
    """심볼의 정의를 ctags 인덱스에서 찾아 반환"""
    if ctags_index is None:
        raise RuntimeError("Index not initialized yet")
    entries = ctags_index.find_definitions(symbol, file=file, language=language)
    results: List[dict] = []
    for e in entries[:10]:
        from pathlib import Path
        p = (REPO_ROOT / e.file).resolve()
        if not (is_allowed_path(p) and has_allowed_ext(p)):
            continue
        item: dict = {
            "file": str(p.relative_to(REPO_ROOT)),
            "line": e.line,
            "kind": e.kind,
            "language": e.language,
            "signature": e.signature,
            "scope": e.scope,
        }
        if include_body:
            bounds = detect_function_bounds(p, e.line)
            if bounds:
                s, t = bounds
                try:
                    lines = p.read_text(errors="ignore").splitlines()
                    s = max(1, s); t = min(len(lines), t)
                    text = "\n".join(lines[s-1:t])
                    truncated = False
                    if len(text.encode("utf-8")) > 4096:
                        text = text.encode("utf-8")[:4096].decode("utf-8", errors="ignore")
                        truncated = True
                    item["body"] = text
                    item["body_truncated"] = truncated
                    item["start_line"] = s
                    item["end_line"] = t
                except Exception:
                    pass
        results.append(item)
    return {
        "repo": str(REPO_ROOT),
        "rev": REPO_REV,
        "symbol": symbol,
        "results": results,
    }

@mcp.tool()
def reindex() -> dict:
    """ctags 인덱스를 다시 빌드"""
    global ctags_index
    if ctags_index is None:
        ctags_index = CTagsIndex(REPO_ROOT)
    ctags_index.build()
    return {"status": "ok", "repo": str(REPO_ROOT)}

def main():
    initialize_index()
    
    """MCP 서버를 HTTP 스트리밍 모드로 실행"""
    mcp.run(transport="streamable-http")

    """MCP 서버를 STDIO 모드로 실행 (Claude Desktop)"""
    # mcp.run(transport="stdio")
    
if __name__ == "__main__":
    main()
