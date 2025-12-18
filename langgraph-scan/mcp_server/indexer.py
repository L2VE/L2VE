"""
코드 인덱싱 및 검색 로직
ctags 인덱스 및 ripgrep 검색 기능 구현
"""

from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from config import (
    REPO_ROOT, CTAGS_BIN, RG_BIN,
    DEFAULT_MAX_RESULTS, HARD_MAX_RESULTS,
    USE_TREE_SITTER, TREE_SITTER_MAX_FUNC_LINES,
    EXCLUDE_GLOBS, is_allowed_path, has_allowed_ext
)

# ---------------- ctags index ----------------

@dataclass
class DefinitionEntry:
    """ctags에서 찾은 심볼 정의 정보"""
    symbol: str
    file: str
    line: int
    kind: str | None = None
    language: str | None = None
    signature: str | None = None
    scope: str | None = None

class CTagsIndex:
    """ctags를 사용한 코드 심볼 인덱스 클래스"""
    def __init__(self, repo_root: Path) -> None:
        """레포지토리 루트로 인덱스 초기화"""
        self.repo_root = repo_root
        self._by_symbol: Dict[str, List[DefinitionEntry]] = {}

    def build(self) -> None:
        """Python/JS/TS/Java/Kotlin 언어에 대해 ctags 인덱스 빌드"""
        cmd = [
            CTAGS_BIN,
            "-R",
            "--fields=+n+K+S+language",
            "--output-format=json",
            # Narrow languages for speed & precision
            "--languages=+Python,+JavaScript,+TypeScript,+Java,+Kotlin",
            # Extension maps
            "--map-JavaScript=+.js", "--map-JavaScript=+.jsx", "--map-JavaScript=+.mjs",
            "--map-TypeScript=+.ts", "--map-TypeScript=+.tsx",
            "--map-Kotlin=+.kt", "--map-Kotlin=+.kts",
            "-f", "-",
            str(self.repo_root)
        ]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd=self.repo_root)
        if not proc.stdout:
            logging.error("Failed to run ctags (no stdout). Is universal-ctags installed?")
            raise RuntimeError("Failed to run ctags (no stdout). Is universal-ctags installed?")

        by_symbol: Dict[str, List[DefinitionEntry]] = {}
        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get("_type") != "tag" and obj.get("type") != "tag":
                continue
            name = obj.get("name")
            path = obj.get("path")
            fields = obj.get("fields", {})
            lang = fields.get("language") or obj.get("language")
            kind = obj.get("kind") or fields.get("kind")
            line_no = obj.get("line") or fields.get("line")
            try:
                line_no = int(line_no) if line_no is not None else None
            except Exception:
                line_no = None
            sig = fields.get("signature")
            scope = fields.get("scope") or fields.get("class") or fields.get("namespace")
            if not name or not path or line_no is None:
                continue
            entry = DefinitionEntry(symbol=name, file=str(Path(path)), line=line_no, kind=kind, language=lang, signature=sig, scope=scope)
            by_symbol.setdefault(name, []).append(entry)

        stderr = proc.stderr.read() if proc.stderr else ""
        code = proc.wait()
        if code != 0:
            logging.error(f"ctags exited with {code}: {stderr}")
            raise RuntimeError(f"ctags exited with {code}: {stderr}")
        self._by_symbol = by_symbol

    def find_definitions(self, symbol: str, file: Optional[str] = None, language: Optional[str] = None) -> List[DefinitionEntry]:
        """심볼의 정의를 찾아 반환 (파일/언어 필터링 가능)"""
        entries = self._by_symbol.get(symbol, [])
        if file:
            entries = [e for e in entries if os.path.normpath(e.file) == os.path.normpath(file)]
        if language:
            entries = [e for e in entries if (e.language or "").lower() == language.lower()]
        preferred = [e for e in entries if e.kind in ("function","method","class","typedef","struct")]
        if preferred:
            return preferred
        return entries

# --------------- ripgrep search ---------------

@dataclass
class Reference:
    """ripgrep에서 찾은 참조 정보"""
    file: str
    line: int
    snippet: str

def _rg_json_matches(args: List[str]) -> Iterable[Dict[str, Any]]:
    """ripgrep을 JSON 모드로 실행하여 매치 객체 반환"""
    proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd=REPO_ROOT)
    if not proc.stdout:
        return
    for line in proc.stdout:
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if obj.get("type") == "match":
            yield obj
    if proc.stderr:
        _ = proc.stderr.read()
    proc.wait()

def find_references_with_ripgrep(symbol_or_pattern: str, subdir: Optional[str], max_results: int) -> Tuple[List[Reference], int]:
    """ripgrep으로 심볼/패턴의 참조를 검색하여 반환"""
    if max_results <= 0:
        max_results = DEFAULT_MAX_RESULTS
    max_results = min(max_results, HARD_MAX_RESULTS)

    search_root = (REPO_ROOT / subdir) if subdir else REPO_ROOT
    search_root = search_root.resolve()
    if not str(search_root).startswith(str(REPO_ROOT)):
        logging.error(f"Invalid subdir: {subdir} resolves to {search_root} which is outside {REPO_ROOT}")
        raise ValueError("Invalid subdir")

    is_regex = any(ch in symbol_or_pattern for ch in r".*+?[](){}|\^$")
    base_args = [RG_BIN, "--json", "-n", "-S"]
    if not is_regex:
        base_args += ["-w"]
    # Apply exclude globs
    for g in EXCLUDE_GLOBS:
        base_args += ["--glob", g]
    # Allowed extension filter
    for ext in set(["*"+ext for ext in os.getenv("ALLOWED_EXTS", "").split(",") if ext]):
        if ext != "*":
            base_args += ["--glob", f"*{ext}"]
    base_args += ["-m", str(max_results), symbol_or_pattern, str(search_root)]

    refs: List[Reference] = []
    total = 0
    for m in _rg_json_matches(base_args):
        data = m.get("data", {})
        path = data.get("path", {}).get("text")
        line_no = data.get("line_number")
        lines = data.get("lines", {}).get("text", "")
        if not path or not line_no:
            continue
        p = (REPO_ROOT / path).resolve()
        if not (str(p).startswith(str(REPO_ROOT)) and has_allowed_ext(p)):
            continue
        snippet = lines.rstrip("\n")
        refs.append(Reference(file=str(p.relative_to(REPO_ROOT)), line=int(line_no), snippet=snippet))
        total += 1
        if len(refs) >= max_results:
            break
    return refs, total

# --------------- optional tree-sitter for function bounds ---------------

def detect_function_bounds(path: Path, line: int) -> Tuple[int,int] | None:
    """tree-sitter로 지정 라인 주변의 가장 작은 함수/메서드 범위 찾기"""
    if not USE_TREE_SITTER:
        return None
    try:
        from tree_sitter_languages import get_language, get_parser
    except Exception as e:
        logging.debug(f"tree-sitter not available: {e}")
        return None
    # Guess language from extension
    ext = path.suffix.lower().lstrip(".")
    lang_name = {
        "py": "python",
        "js": "javascript", "jsx": "javascript", "mjs": "javascript",
        "ts": "typescript", "tsx": "tsx",
        "java": "java",
        "kt": "kotlin", "kts": "kotlin",
    }.get(ext)
    if not lang_name:
        return None
    try:
        lang = get_language(lang_name)
        parser = get_parser(lang_name)
    except Exception as e:
        logging.debug(f"Failed to get tree-sitter parser for {lang_name}: {e}")
        return None
    src = path.read_text(errors="ignore")
    tree = parser.parse(bytes(src, "utf-8"))
    target_byte = _line_to_byte_offset(src, line)
    node = tree.root_node
    best: Optional[Tuple[int,int]] = None

    def visit(n):
        """트리 노드를 순회하며 함수 노드 찾기"""
        nonlocal best
        # Generic set of function-like nodes across languages
        funcish = (
            "function_definition","function_declaration","method_definition","function_item",
            "function","method","class_method_definition","constructor_declaration"
        )
        if n.start_byte <= target_byte <= n.end_byte:
            if n.type in funcish:
                s_line = n.start_point[0] + 1
                e_line = n.end_point[0] + 1
                if (e_line - s_line) <= TREE_SITTER_MAX_FUNC_LINES:
                    best = (s_line, e_line) if (best is None or (e_line - s_line) < (best[1]-best[0])) else best
            for i in range(n.named_child_count):
                visit(n.named_children[i])
    visit(node)
    return best

def _line_to_byte_offset(src: str, line: int) -> int:
    """라인 번호를 바이트 오프셋으로 변환"""
    if line <= 1:
        return 0
    count = 0
    i = 1
    for ch in src:
        count += 1
        if ch == '\n':
            i += 1
            if i >= line:
                break
    return count

def clamp(n: int, lo: int, hi: int) -> int:
    """값을 지정된 범위로 제한"""
    return max(lo, min(hi, n))
