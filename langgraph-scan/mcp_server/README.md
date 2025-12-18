# Code Index MCP Server (Python) — Patched for Py/JS/TS/Java/Kotlin

**Tools (Flowise Custom MCP compatible)**
- `find_references` — **ripgrep** search with **exclude globs** and allowed extension filters
- `read_definition` — **universal‑ctags** with **language narrowing** and **extension maps**; optional **tree‑sitter** function bounds
- `read_source` — ±N lines around a line (byte‑capped, path/extension guarded)
- `reindex` — rebuild ctags index

## Language Focus
- CTags languages: **Python, JavaScript, TypeScript, Java, Kotlin**
- Extension maps: `.js,.jsx,.mjs → JavaScript`, `.ts,.tsx → TypeScript`, `.kt,.kts → Kotlin`
- Tree‑sitter map includes: `python`, `javascript`, `typescript`, `tsx`, `java`, `kotlin`

## Requirements
- Python **3.10+**
- System binaries: **universal‑ctags**, **ripgrep**
- Optional: `tree_sitter_languages`

## Install
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Configure
Use env vars or `.env` (see example). Important:
- `REPO_ROOT=/abs/path/to/your/repo`
- `USE_TREE_SITTER=true` to enable function‑boundary extraction
- `EXCLUDE_GLOBS` to skip `node_modules`, `build`, `dist`, `target`, `venv`, etc.

## Run (Streamable HTTP)
```bash
python server.py
# Endpoint: http://0.0.0.0:8000/mcp
```

## Flowise (Custom MCP)
- Add Custom MCP → URL: `http://<host>:8000/mcp`
- Refresh actions → `find_references`, `read_definition`, `read_source`, `reindex`

## I/O Contracts
See inline docstrings or previous README; the schema is identical but with added language/exclude features.

