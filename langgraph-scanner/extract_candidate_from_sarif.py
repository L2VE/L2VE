import json
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from collections import defaultdict

def _as_iter(x: Any) -> Iterable:
    if x is None:
        return []
    if isinstance(x, list):
        return x
    if isinstance(x, dict):
        return x.values()
    return []

def _format_line(start: Optional[int], end: Optional[int]) -> Optional[str]:
    if start is None and end is None:
        return None
    if start is None:
        return str(end)
    if end is None or end == start:
        return str(start)
    return f"{start}-{end}" if end > start else str(start)

def _parse_line(line_str: str) -> Optional[Tuple[int, int]]:
    """
    "14" -> (14,14), "14-16" -> (14,16)
    """
    if not line_str:
        return None
    try:
        if "-" in line_str:
            s, e = line_str.split("-", 1)
            return int(s), int(e)
        return int(line_str), int(line_str)
    except Exception:
        return None

def extract_flat(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    runs[*].results[*].locations[*].physicalLocation 평탄화
    - artifactLocation.uri       -> "file_path"
    - region.startLine/endLine   -> "line_num" ("14-15" 또는 "14")
    - region.snippet.text        -> "code_snippet"
    - uriBaseId 제외
    - startColumn/endColumn 제외
    """
    out: List[Dict[str, Any]] = []

    for run in _as_iter(data.get("runs", [])):
        for res in _as_iter((run or {}).get("results", [])):
            for loc in _as_iter((res or {}).get("locations", [])):
                pl = (loc or {}).get("physicalLocation") or {}
                artifact = pl.get("artifactLocation") or {}
                region = pl.get("region") or {}

                entry: Dict[str, Any] = {}

                # file_path (from artifactLocation.uri)
                uri = artifact.get("uri")
                if uri is not None:
                    entry["file_path"] = uri

                # line_num
                line_str = _format_line(region.get("startLine"), region.get("endLine"))
                if line_str is not None:
                    entry["line_num"] = line_str

                # code_snippet
                snippet = region.get("snippet")
                text = snippet.get("text") if isinstance(snippet, dict) else None
                if text is not None:
                    entry["code_snippet"] = text

                # 비어있지 않을 때만 추가
                if entry:
                    out.append(entry)

    return out

def dedupe(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    완전 동일(dict 동등) 항목만 제거. 첫 등장 순서 유지.
    """
    seen = set()
    uniq: List[Dict[str, Any]] = []
    for it in items:
        key = json.dumps(it, sort_keys=True, ensure_ascii=False)
        if key not in seen:
            seen.add(key)
            uniq.append(it)
    return uniq

def merge_adjacent(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    같은 file_path 내에서 연속되거나 겹치는(line_num 기준) 구간을 하나로 병합.
    code_snippet은 줄바꿈으로 연결.
    - 입력: [{"file_path", "line_num", "code_snippet"?}, ...]
    - 출력: 같은 구조, 단 line_num이 병합되어 "start-end"/"start" 형태.
    """
    # file_path가 없는 항목은 그대로 둠
    with_path: List[Tuple[int, Dict[str, Any]]] = []
    without_path: List[Dict[str, Any]] = []
    for idx, it in enumerate(items):
        if "file_path" in it:
            with_path.append((idx, it))
        else:
            without_path.append(it)

    # file_path별 그룹핑
    groups: Dict[str, List[Tuple[int, Dict[str, Any]]]] = defaultdict(list)
    for idx, it in with_path:
        groups[it["file_path"]].append((idx, it))

    merged_all: List[Tuple[int, Dict[str, Any]]] = []

    for file_path, group in groups.items():
        # (원래 순서를 보조키로 보존) + line_num 파싱
        parsed: List[Tuple[int, int, int, Dict[str, Any]]] = []  # (start, end, orig_idx, item)
        for orig_idx, it in group:
            ln = it.get("line_num")
            pr = _parse_line(ln) if isinstance(ln, str) else None
            if pr is None:
                # line_num이 없거나 파싱 불가하면 start/end를 매우 큰 값으로 하여 뒤로 밀어 병합 안 함
                parsed.append((10**12 + orig_idx, 10**12 + orig_idx, orig_idx, it))
            else:
                parsed.append((pr[0], pr[1], orig_idx, it))

        # start, end, orig_idx로 정렬
        parsed.sort(key=lambda x: (x[0], x[1], x[2]))

        # 병합
        cur_start = None  # type: Optional[int]
        cur_end = None    # type: Optional[int]
        cur_snippets: List[str] = []
        cur_indices: List[int] = []

        def _flush():
            nonlocal cur_start, cur_end, cur_snippets, cur_indices
            if cur_start is None or cur_end is None:
                return
            merged_item: Dict[str, Any] = {"file_path": file_path}
            merged_item["line_num"] = _format_line(cur_start, cur_end)
            # code_snippet이 하나도 없으면 키 자체를 생략
            snippet_text = "\n".join([s for s in cur_snippets if s is not None and s != ""])
            if snippet_text:
                merged_item["code_snippet"] = snippet_text
            # 출력의 상대적 순서를 첫 항목의 orig_idx로 대체
            merged_all.append((min(cur_indices), merged_item))
            # reset
            cur_start = cur_end = None
            cur_snippets = []
            cur_indices = []

        for s, e, orig_idx, it in parsed:
            # 병합 대상이 아닌(파싱 불가한) sentinel은 바로 flush 후 개별 추가
            if s >= 10**12:
                _flush()
                # 개별 원소는 line_num 그대로 둔다.
                single = {"file_path": file_path}
                if "line_num" in it and isinstance(it["line_num"], str):
                    single["line_num"] = it["line_num"]
                if it.get("code_snippet"):
                    single["code_snippet"] = it["code_snippet"]
                merged_all.append((orig_idx, single))
                continue

            # 첫 시작
            if cur_start is None:
                cur_start, cur_end = s, e
                if it.get("code_snippet") is not None:
                    cur_snippets.append(it.get("code_snippet"))
                cur_indices.append(orig_idx)
                continue

            # 인접/겹침이면 병합 (다음 구간의 시작 <= 현재 끝 + 1)
            if s <= (cur_end + 1):
                cur_end = max(cur_end, e)
                if it.get("code_snippet") is not None:
                    cur_snippets.append(it.get("code_snippet"))
                cur_indices.append(orig_idx)
            else:
                # 떨어져 있으면 flush 후 새 구간 시작
                _flush()
                cur_start, cur_end = s, e
                cur_snippets = [it.get("code_snippet")] if it.get("code_snippet") is not None else []
                cur_indices = [orig_idx]

        # 마지막 구간 flush
        _flush()

    # file_path가 없던 항목들도 원래 순서를 유지하도록 인덱스를 부여
    # without_path는 입력 순서를 유지하고, with_path 병합 결과와 함께 전체 정렬
    # 원래 전체 순서를 대략 보존하기 위해, 인덱스가 없는 것들은 큰 값을 더해 뒤에 두지 않고,
    # 입력에서의 상대 위치를 존중하려면 with_path/without_path가 섞여 있었던 원래 인덱스를 사용해야 하지만
    # 여기서는 충분히 실용적으로 with_path 내 상대순서만 보존합니다.
    # 필요하다면 원본 인덱스를 items에 주입해 더 엄밀히 재구성할 수 있습니다.

    # 일단 without_path는 그대로 뒤에 둔다.
    merged_all.sort(key=lambda x: x[0])
    output = [it for _, it in merged_all] + without_path
    return output

def main(in_path: str, out_path: str | None = None) -> None:
    data = json.loads(Path(in_path).read_text(encoding="utf-8"))
    flattened = extract_flat(data)
    deduped = dedupe(flattened)
    merged = merge_adjacent(deduped)

    text = json.dumps(merged, ensure_ascii=False, indent=2)
    if out_path:
        Path(out_path).write_text(text, encoding="utf-8")
    else:
        print(text)

if __name__ == "__main__":
    in_path = sys.argv[1]
    out_path = sys.argv[2]
    main(in_path, out_path)
