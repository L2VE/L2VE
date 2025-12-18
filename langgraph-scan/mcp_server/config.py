"""
MCP 서버 설정 파일
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Sequence

# -------- Basic settings --------
REPO_ROOT: Path = Path(os.getenv("REPO_ROOT", ".")).resolve()
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8000"))

# Maximum bytes returned in any text field
MAX_BYTES: int = int(os.getenv("MAX_BYTES", "8192"))
# Max lines of context around a target line
DEFAULT_BEFORE: int = int(os.getenv("DEFAULT_BEFORE", "40"))
DEFAULT_AFTER: int = int(os.getenv("DEFAULT_AFTER", "40"))
MAX_BEFORE: int = int(os.getenv("MAX_BEFORE", "120"))
MAX_AFTER: int = int(os.getenv("MAX_AFTER", "120"))

# find_references defaults
DEFAULT_MAX_RESULTS: int = int(os.getenv("DEFAULT_MAX_RESULTS", "50"))
HARD_MAX_RESULTS: int = int(os.getenv("HARD_MAX_RESULTS", "500"))

# Restrict read_source / reference search to these extensions (comma-separated).
ALLOWED_EXTS: Sequence[str] = tuple(
    [ext.strip() for ext in os.getenv(
        "ALLOWED_EXTS",
        ".c,.cc,.cpp,.cxx,.h,.hpp,.py,.js,.jsx,.mjs,.ts,.tsx,.java,.kt,.kts,.go,.rs,.rb,.php,.cs,.scala,.swift,.m,.mm,.proto,.yml,.yaml,.toml,.json,.ini,.txt,.md"
    ).split(",") if ext.strip()]
)

# Ripgrep & ctags binaries
RG_BIN: str = os.getenv("RG_BIN", "rg")
CTAGS_BIN: str = os.getenv("CTAGS_BIN", "ctags")  # universal-ctags required

# Optional Tree-sitter (requires 'tree_sitter_languages' or individual language packages)
USE_TREE_SITTER: bool = os.getenv("USE_TREE_SITTER", "true").lower() in ("1","true","yes")
TREE_SITTER_MAX_FUNC_LINES: int = int(os.getenv("TREE_SITTER_MAX_FUNC_LINES", "500"))

# Exclude globs for ripgrep
EXCLUDE_GLOBS = tuple(
    g.strip() for g in os.getenv("EXCLUDE_GLOBS", """
!.git
!**/.git/**
!node_modules/**
!**/node_modules/**
!build/**
!dist/**
!target/**
!out/**
!venv/**
!**/__pycache__/**
!.gradle/**
!.idea/**
!.mvn/**
""").splitlines() if g.strip()
)

# Git metadata for reproducibility
def detect_git_rev(repo: Path) -> str | None:
    """Git 레포지토리의 현재 commit hash 검출"""
    import subprocess
    try:
        rev = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], stderr=subprocess.DEVNULL, text=True).strip()
        return rev or None
    except Exception as e:
        logging.debug(f"Failed to detect git revision: {e}")
        return None

REPO_REV: str | None = detect_git_rev(REPO_ROOT)

def is_allowed_path(p: Path) -> bool:
    """경로가 허용된 범위 내에 있는 파일인지 확인"""
    try:
        p = p.resolve()
        return str(p).startswith(str(REPO_ROOT)) and p.is_file()
    except Exception as e:
        logging.debug(f"Path validation failed for {p}: {e}")
        return False

def has_allowed_ext(p: Path) -> bool:
    """파일이 허용된 확장자를 가지고 있는지 확인"""
    return any(str(p).endswith(ext) for ext in ALLOWED_EXTS)
