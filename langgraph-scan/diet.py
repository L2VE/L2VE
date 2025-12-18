#!/usr/bin/env python3
# sarif_parser.py
# Output schema per result:
# {
#   "id": <int>,
#   "vulnerability_info": "<message with [..](n) -> <source#N>>",
#   "sink":   { "file_path": "<path>", "line_range": [start, end] },  # from results.locations[0]
#   "source": [ { "id": n, "file_path": "<path>", "line_range": [start, end], "note": "<text>" }, ... ],  # only if non-empty
#   "taint_flow": [
#     [ { "step": 1, "file_path": "<path>", "line": <int>, "label": "<text>" }, ... ],
#     ...
#   ]  # only if non-empty
# }

import json
import re
import sys
import argparse
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import ijson

# e.g., "" -> groups: label="user input", id="1"
ANCHOR_RE = re.compile(r"\[(.*?)\]\((\d+)\)")

def load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def get(obj: Any, path: List[Any], default=None):
    cur = obj
    for key in path:
        if isinstance(cur, dict) and key in cur:
            cur = cur[key]
        elif isinstance(cur, list) and isinstance(key, int) and 0 <= key < len(cur):
            cur = cur[key]
        else:
            return default
    return cur

def region_to_line_range(region: Dict[str, Any]) -> List[int]:
    if not region:
        return [0, 0]
    start = region.get("startLine") or region.get("endLine") or 0
    end = region.get("endLine", start) if start else 0
    if not end:
        end = start
    return [int(start), int(end)]

def region_start_line(region: Dict[str, Any]) -> int:
    if not region:
        return 0
    return int(region.get("startLine") or region.get("endLine") or 0)

def normalize_newlines(text: str) -> str:
    # normalize to \n; keep leading newlines for line alignment, trim trailing newline only
    return text.replace("\r\n", "\n").replace("\r", "\n").rstrip("\n")

def slice_snippet_to_region(snippet: str, snippet_region: Dict[str, Any], target_region: Dict[str, Any]) -> str:
    """Slice snippet text to the target region if region info matches up; else return full snippet."""
    def _start_end(region: Dict[str, Any]) -> Optional[tuple[int, int]]:
        start = region.get("startLine") or region.get("endLine")
        if start is None:
            return None
        end = region.get("endLine") or start
        return int(start), int(end)

    sn_span = _start_end(snippet_region)
    tgt_span = _start_end(target_region)
    if not sn_span or not tgt_span:
        return snippet

    sn_start, sn_end = sn_span
    tgt_start, tgt_end = tgt_span

    lines = snippet.rstrip("\n").split("\n")
    start_idx = max(0, tgt_start - sn_start)
    end_idx = min(len(lines) - 1, tgt_end - sn_start)
    if start_idx > end_idx or start_idx >= len(lines):
        return snippet
    return "\n".join(lines[start_idx:end_idx + 1]).strip("\n")

def extract_location_fields(
    physical: Optional[Dict[str, Any]],
    snippet_mode: str
) -> Tuple[str, Dict[str, Any], Optional[str]]:
    """Return (file_path, region_for_range, code_snippet|None) based on snippet_mode."""
    if not isinstance(physical, dict):
        return "", {}, None

    uri = get(physical, ["artifactLocation", "uri"], "") or ""
    region = get(physical, ["region"], {}) or {}
    context_region = get(physical, ["contextRegion"], {}) or {}

    use_context_for_region = snippet_mode == "full" and context_region
    region_for_range = context_region if use_context_for_region else region

    code_snippet: Optional[str] = None
    if snippet_mode != "no":
        raw_snippet = get(context_region, ["snippet", "text"], "") or ""
        if raw_snippet:
            normalized = normalize_newlines(raw_snippet)
            if snippet_mode == "normal" and context_region and region:
                code_snippet = slice_snippet_to_region(normalized, context_region, region)
            else:
                code_snippet = normalized

    return uri, region_for_range, code_snippet

# ---------- message ----------
def parse_message_text(result: Dict[str, Any]) -> str:
    return get(result, ["message", "text"], "") or ""

def message_with_source_placeholders(message_text: str) -> str:
    # "[label](n)" -> "<source#N>"
    return ANCHOR_RE.sub(lambda m: f"<source#{m.group(2)}>", message_text or "")

# ---------- source (ALL relatedLocations) ----------
def parse_all_sources(result: Dict[str, Any], snippet_mode: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for rl in (result.get("relatedLocations") or []):
        if not isinstance(rl, dict):
            continue
        rid = rl.get("id")
        if rid is None:
            continue
        phys = get(rl, ["physicalLocation"], {}) or {}
        uri, region, code_snippet = extract_location_fields(phys, snippet_mode)
        note = get(rl, ["message", "text"], "") or ""
        item = {
            "id": int(rid),
            "file_path": uri,
            "line_range": region_to_line_range(region),
            "note": note
        }
        if code_snippet is not None:
            item["code_snippet"] = code_snippet
        out.append(item)
    out.sort(key=lambda x: x["id"])
    return out

# ---------- taint_flow (산출은 하지만 sink 계산에는 미사용) ----------
def parse_taint_flows(result: Dict[str, Any], snippet_mode: str) -> List[List[Dict[str, Any]]]:
    flows_out: List[List[Dict[str, Any]]] = []
    for cf in (result.get("codeFlows") or []):
        for tf in (cf.get("threadFlows") or []):
            raw_steps: List[Dict[str, Any]] = []
            for _, loc in enumerate(tf.get("locations") or [], start=1):
                loc_obj = get(loc, ["location"], {}) or {}
                phys = get(loc_obj, ["physicalLocation"], {}) or {}
                uri, region, code_snippet = extract_location_fields(phys, snippet_mode)
                step_obj = {
                    "file_path": uri,
                    "line": region_start_line(region)  # taint_flow?? line?? ???
                }
                if code_snippet is not None:
                    step_obj["code_snippet"] = code_snippet
                raw_steps.append(step_obj)

            if raw_steps:
                deduped: List[Dict[str, Any]] = []
                for s in raw_steps:
                    if not deduped or deduped[-1]["file_path"] != s["file_path"] or deduped[-1]["line"] != s["line"]:
                        deduped.append(s)
                renumbered: List[Dict[str, Any]] = []
                for idx, s in enumerate(deduped, start=1):
                    ordered = {"step": idx, "file_path": s["file_path"], "line": s["line"]}
                    if "code_snippet" in s:
                        ordered["code_snippet"] = s["code_snippet"]
                    renumbered.append(ordered)
                flows_out.append(renumbered)
    return flows_out

# ---------- sink (항상 results.locations[0]만 사용) ----------
def select_sink_from_locations(result: Dict[str, Any], snippet_mode: str) -> Dict[str, Any]:
    loc0_phys = get(result, ["locations", 0, "physicalLocation"], {})
    uri, region, code_snippet = extract_location_fields(loc0_phys, snippet_mode)
    sink = {"file_path": uri, "line_range": region_to_line_range(region)}
    if code_snippet is not None:
        sink["code_snippet"] = code_snippet
    return sink

# ---------- pretty helpers ----------
# 1) "line_range": [a, b] 를 한 줄로
LINE_RANGE_BLOCK_RE = re.compile(
    r'("line_range"\s*:\s*)\[\s*\n\s*(\d+)\s*,\s*\n\s*(\d+)\s*\n\s*\]',
    flags=re.DOTALL
)

def inline_line_ranges(json_text: str) -> str:
    return LINE_RANGE_BLOCK_RE.sub(lambda m: f'{m.group(1)}[{m.group(2)}, {m.group(3)}]', json_text)

# 2) sink 블록 한줄로 (code_snippet optional)
SINK_BLOCK_RE = re.compile(
    r'("sink"\s*:\s*)\{\s*\n\s*"file_path"\s*:\s*"([^"]*)",\s*\n\s*"line_range"\s*:\s*\[(.*?)\](?:,\s*\n\s*"code_snippet"\s*:\s*"(.*?)")?\s*\n\s*\}',
    flags=re.DOTALL
)

def inline_sink_blocks(text: str) -> str:
    def repl(m):
        prefix, path, lr, snippet = m.group(1), m.group(2), m.group(3), m.group(4)
        base = f'{prefix}{{"file_path": "{path}", "line_range": [{lr}]'
        if snippet is not None:
            base += f', "code_snippet": "{snippet}"'
        return base + '}'
    return SINK_BLOCK_RE.sub(repl, text)

# 3) source 아이템 한줄로 (code_snippet optional)
SOURCE_ITEM_RE = re.compile(
    r'\{\s*\n\s*"id"\s*:\s*(\d+),\s*\n\s*"file_path"\s*:\s*"([^"]*)",\s*\n\s*"line_range"\s*:\s*\[(.*?)\],\s*\n\s*"note"\s*:\s*"([^"]*)"(?:,\s*\n\s*"code_snippet"\s*:\s*"(.*?)")?\s*\n\s*\}',
    flags=re.DOTALL
)

def inline_source_items(text: str) -> str:
    def repl(m):
        id_, path, lr, note, snippet = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
        base = '{ "id": ' + id_ + ', "file_path": "' + path + '", "line_range": [' + lr + '], "note": "' + note + '"'
        if snippet is not None:
            base += ', "code_snippet": "' + snippet + '"'
        return base + ' }'
    return SOURCE_ITEM_RE.sub(repl, text)

# 4) taint_flow step 한줄로 (code_snippet optional)
TAINT_STEP_RE = re.compile(
    r'\{\s*\n\s*"step"\s*:\s*(\d+),\s*\n\s*"file_path"\s*:\s*"([^"]*)",\s*\n\s*"line"\s*:\s*(\d+)(?:,\s*\n\s*"code_snippet"\s*:\s*"(.*?)")?\s*\n\s*\}',
    flags=re.DOTALL
)

def inline_taint_steps(text: str) -> str:
    def repl(m):
        step, path, line, snippet = m.group(1), m.group(2), m.group(3), m.group(4)
        base = '{ "step": ' + step + ', "file_path": "' + path + '", "line": ' + line
        if snippet is not None:
            base += ', "code_snippet": "' + snippet + '"'
        return base + ' }'
    return TAINT_STEP_RE.sub(repl, text)

def compact_objects(json_text: str, do_line_range=True, do_compact=True) -> str:
    # 1) line_range 는 기본 한줄화
    if do_line_range:
        json_text = inline_line_ranges(json_text)
    # 2) sink/source/taint step 한줄화
    if do_compact:
        prev = None
        while prev != json_text:
            prev = json_text
            json_text = inline_sink_blocks(json_text)
            json_text = inline_source_items(json_text)
            json_text = inline_taint_steps(json_text)
    return json_text
# ---------- per result ----------
def parse_result_to_seed(result: Dict[str, Any], idx: int, snippet_mode: str) -> Dict[str, Any]:
    msg = parse_message_text(result)
    seed: Dict[str, Any] = {
        "id": idx,
        "vulnerability_info": message_with_source_placeholders(msg),
        "sink": select_sink_from_locations(result, snippet_mode)
    }

    sources = parse_all_sources(result, snippet_mode)
    if sources:  # 빈 리스트면 키 자체를 생략
        seed["source"] = sources

    tf = parse_taint_flows(result, snippet_mode)
    if tf:      # 빈 리스트면 키 자체를 생략
        seed["taint_flow"] = tf

    return seed

def parse_sarif(log: Dict[str, Any], snippet_mode: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    idx = 1
    for run in (log.get("runs") or []):
        for result in (run.get("results") or []):
            out.append(parse_result_to_seed(result, idx, snippet_mode))
            idx += 1
    return out

def default_output_path(input_path: Path) -> Path:
    # 파일명_extarct.json (요청한 철자 유지)
    return input_path.with_name(f"{input_path.stem}_extract.json")

def iter_results_stream(input_path: Path) -> Iterable[Dict[str, Any]]:
    """Stream results from SARIF without loading the full file into memory."""
    with open(input_path, "rb") as f:
        yield from ijson.items(f, "runs.item.results.item")

def write_streaming_output(
    input_path: Path,
    out_handle,
    snippet_mode: str,
    indent: int,
    do_line_range: bool,
    do_compact: bool
) -> None:
    out_handle.write("[")
    first = True
    for idx, result in enumerate(iter_results_stream(input_path), start=1):
        seed = parse_result_to_seed(result, idx, snippet_mode)
        chunk = json.dumps(seed, ensure_ascii=False, indent=indent)
        chunk = compact_objects(
            chunk,
            do_line_range=do_line_range,
            do_compact=do_compact
        )
        if first:
            out_handle.write("\n")
            first = False
        else:
            out_handle.write(",\n")
        out_handle.write(chunk)
    if not first:
        out_handle.write("\n")
    out_handle.write("]\n")

def main():
    ap = argparse.ArgumentParser(description="Parse SARIF into simplified seed schema (sink from locations[0]).")
    ap.add_argument("--input", required=True, help="Path to SARIF JSON file")
    ap.add_argument("-o", "--output", help="Write output JSON to this file (default: <input>_extract.json)")
    ap.add_argument("--stdout", action="store_true", help="Print to stdout instead of writing a file")
    ap.add_argument("--indent", type=int, default=2, help="JSON indent (default: 2)")
    ap.add_argument("--no-inline-line-range", action="store_true", help="Do not collapse multi-line line_range arrays")
    ap.add_argument("--no-compact", action="store_true", help="Do not collapse sink/source/taint_flow objects to one line")
    ap.add_argument(
        "--snippet",
        choices=["no", "normal", "full"],
        default="normal",
        help="Include code_snippet (default: normal)."
    )
    args = ap.parse_args()

    in_path = Path(args.input)
    if not in_path.exists():
        raise SystemExit(f"[!] Input not found: {in_path}")

    write_kwargs = {
        "input_path": in_path,
        "snippet_mode": args.snippet,
        "indent": args.indent,
        "do_line_range": not args.no_inline_line_range,
        "do_compact": not args.no_compact
    }

    if args.stdout:
        write_streaming_output(out_handle=sys.stdout, **write_kwargs)
        return

    out_path = Path(args.output) if args.output else default_output_path(in_path)
    with open(out_path, "w", encoding="utf-8") as f:
        write_streaming_output(out_handle=f, **write_kwargs)
    print(f"[✓] Wrote {out_path}")

if __name__ == "__main__":
    main()
