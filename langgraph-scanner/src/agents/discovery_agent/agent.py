"""
Discovery Agent - Main agent class
"""
import json
import uuid
from pathlib import Path
from typing import Any, List, Optional
import asyncio
from .graph import build_discovery_graph
from ...models import DiscoveryState
from ...config import DISCOVERY_MAX_WORKERS, DISCOVERY_WORKER_MAX_RETRIES, DISCOVERY_RECURSION_LIMIT
from ...utils import fetch_unseen_vulnerabilities
from ...utils.api_client import batch_update_vulnerabilities
from .nodes import _load_seed_entries_from_file  # type: ignore


class DiscoveryAgent:
    """
    Discovery Agent for classifying vulnerability seeds
    
    This agent:
    1. Fetches unseen vulnerability elements from API
    2. Splits them into manageable chunks (max 3000 chars JSON)
    3. Uses LLM + MCP tools to classify vulnerability types
    4. Sends classified results back to API
    5. Repeats until all elements are classified
    """
    
    def __init__(
        self,
        llm,
        mcp_client,
        provider: str = "unknown",
        seed_source: str = "http",
        seed_file: Optional[str] = None,
    ):
        self.llm = llm
        self.mcp_client = mcp_client
        self.provider = provider
        self.seed_source = (seed_source or "http").lower()
        self.seed_file = seed_file

    def _load_seed_payload(self, seed_path: Path) -> List[Any]:
        if not seed_path.exists():
            raise FileNotFoundError(f"Seed file not found: {seed_path}")
        with seed_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        if isinstance(payload, dict) and "elements" in payload:
            payload = payload["elements"]
        if not isinstance(payload, list):
            raise ValueError(f"Seed data must be a list, got {type(payload).__name__}")
        return payload

    def _ensure_local_seed_file(self, project_title: str) -> str:
        if self.seed_source != "json":
            return ""
        if not self.seed_file:
            raise ValueError("--input-seed-file is required when --input-seed-source=json")
        seed_path = Path(self.seed_file)
        elements = None

        output_dir = Path("discovery_results")
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{project_title}_discovery.json"

        if output_path.exists():
            # Validate existing file can be parsed
            self._load_seed_payload(output_path)
            print(f"📁 Resuming discovery from local JSON: {output_path}")
        else:
            elements = self._load_seed_payload(seed_path)
            with output_path.open("w", encoding="utf-8") as handle:
                json.dump(elements, handle, ensure_ascii=False, indent=2)
            print(f"📁 Initialized discovery store from {seed_path} -> {output_path}")

        return str(output_path)
    
    async def classify_elements(
        self,
        project_title: str,
        elements: list[Any],
        worker_count: int | None = None,
        callbacks: list | None = None,
    ) -> dict:
        """
        Classify provided elements in parallel. Fetch/update are handled by caller.
        """
        workers = max(1, worker_count or DISCOVERY_MAX_WORKERS)

        if not elements:
            print("✅ No elements to classify.")
            return {
                "project_title": project_title,
                "total_classified": 0,
                "messages": ["No elements to classify"],
                "stage": "completed",
                "discovery_output_file": None,
            }
        unseen_elements = elements[:]

        total_elements = len(unseen_elements)
        print(f"📊 Parallel discovery: total {total_elements} elements, {workers} worker(s)")

        # Slice work for workers
        slices: list[list[Any]] = []
        slice_size = (total_elements + workers - 1) // workers
        for i in range(workers):
            start = i * slice_size
            end = min(start + slice_size, total_elements)
            if start >= end:
                break
            slices.append(unseen_elements[start:end])

        # Build classify-only graph
        classify_graph = build_discovery_graph(
            self.llm, self.mcp_client, self.provider, include_fetch=False, include_update=False
        )

        def make_key(entry: dict[str, Any]):
            return (entry.get("file_path"), str(entry.get("line_num")))

        async def run_worker(idx: int, payload: list[Any]):
            state: DiscoveryState = {
                "project_title": project_title,
                "unseen_elements": payload,
                "total_elements": len(payload),
                "processed_count": 0,
                "current_batch": [],
                "classified_batch": [],
                "all_classified": [],
                "messages": [f"worker-{idx} started"],
                "current_stage": "fetched",
            }
            
            invoke_config = {
                "configurable": {"thread_id": f"discovery::{project_title}::worker-{idx}"},
                "recursion_limit": DISCOVERY_RECURSION_LIMIT  # Increase limit to prevent early exit
            }
            if callbacks:
                invoke_config["callbacks"] = callbacks

            try:
                result = await classify_graph.ainvoke(state, config=invoke_config)
            except Exception as exc:
                print(f"⚠️ Worker {idx} encountered error: {exc}")
                # Try to recover partial state from checkpoint
                try:
                    snapshot = classify_graph.get_state(invoke_config)
                    if snapshot and snapshot.values:
                        print(f"   ↳ Recovered partial state from checkpoint")
                        result = snapshot.values
                        result["messages"].append(f"Runtime error (partial recovery): {exc}")
                    else:
                        raise exc
                except Exception as recovery_exc:
                     print(f"   ↳ Failed to recover state: {recovery_exc}")
                     return {
                        "worker_id": idx,
                        "success": [],
                        "failed": payload,
                        "messages": [f"worker-{idx} error: {exc}"],
                    }

            classified = result.get("all_classified", []) or result.get("classified_batch", [])
            msgs = result.get("messages", [])

            success: list[dict[str, Any]] = []
            found_keys = set()
            for entry in classified:
                vuln_types = entry.get("vulnerability_types") or entry.get("vulnerability_type")
                if not vuln_types:
                    continue
                key = make_key(entry)
                found_keys.add(key)
                success.append(entry)

            payload_keys = {make_key(entry) for entry in payload}
            missing_keys = payload_keys - found_keys
            failed_payload = [entry for entry in payload if make_key(entry) in missing_keys]

            processed = result.get("processed_count", 0)
            total = result.get("total_elements", len(payload))
            extra_msg = []
            if processed < total:
                extra_msg.append(f"processed {processed}/{total}, remainder failed")

            if extra_msg:
                msgs = list(msgs) + extra_msg

            return {
                "worker_id": idx,
                "success": success,
                "failed": failed_payload,
                "messages": msgs,
            }

        # Retry queue of (payload, attempt)
        retry_queue: list[tuple[list[Any], int, int]] = [(payload, 0, idx) for idx, payload in enumerate(slices)]
        merged: dict[tuple[Any, Any], dict[str, Any]] = {}
        messages: list[str] = []
        failed_final: list[dict[str, Any]] = []
        worker_outputs: list[Any] = [None] * len(slices)

        while retry_queue:
            batch = retry_queue[:workers]
            retry_queue = retry_queue[workers:]
            results = await asyncio.gather(
                *(run_worker(worker_idx, payload) for payload, attempt, worker_idx in batch)
            )

            for res, slot in zip(results, batch):
                payload, attempt, worker_idx = slot
                if isinstance(res, Exception):
                    messages.append(f"Worker exception: {res}")
                    if attempt < DISCOVERY_WORKER_MAX_RETRIES:
                        retry_queue.append((payload, attempt + 1, worker_idx))
                    else:
                        failed_final.extend(payload)
                    continue

                wid = res.get("worker_id")
                if wid is not None and wid < len(worker_outputs):
                    worker_outputs[wid] = res

                msgs = res.get("messages", [])
                if msgs:
                    messages.extend([f"[worker-{wid}] {m}" for m in msgs])

                for entry in res.get("success", []):
                    merged[make_key(entry)] = entry

                failed_items = res.get("failed", []) or []
                if failed_items and attempt < DISCOVERY_WORKER_MAX_RETRIES:
                    retry_queue.append((failed_items, attempt + 1, worker_idx))
                elif failed_items:
                    failed_final.extend(failed_items)

        success_entries = list(merged.values())
        print(f"✅ Merged {len(success_entries)} classified elements (dedup by file_path+line_num)")
        if failed_final:
            print(f"⚠️ {len(failed_final)} entries failed after retries")

        # Persist worker input/output snapshots
        out_dir = Path("discovery_results")
        out_dir.mkdir(exist_ok=True)
        for idx, payload in enumerate(slices):
            (out_dir / f"{project_title}_worker_{idx}_input.json").write_text(
                json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        # 워커별 출력도 저장
        for idx, res in enumerate(worker_outputs):
            if res is None:
                content = {"error": "no result (not executed or missing)"}
            elif isinstance(res, Exception):
                content = {"error": str(res)}
            else:
                content = {
                    "worker_id": res.get("worker_id"),
                    "success": res.get("success", []),
                    "failed": res.get("failed", []),
                    "messages": res.get("messages", []),
                }
            (out_dir / f"{project_title}_worker_{idx}_output.json").write_text(
                json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8"
            )

        # Save merged results
        latest_file = out_dir / f"{project_title}_latest_parallel.json"
        latest_file.write_text(json.dumps(success_entries, ensure_ascii=False, indent=2), encoding="utf-8")

        # Save final failed entries if any
        failed_file = None
        if failed_final:
            failed_file = out_dir / f"{project_title}_failed_parallel.json"
            failed_file.write_text(json.dumps(failed_final, ensure_ascii=False, indent=2), encoding="utf-8")

        return {
            "project_title": project_title,
            "total_classified": len(success_entries),
            "messages": messages,
            "stage": "completed",
            "discovery_output_file": str(latest_file),
            "failed_entries": failed_final,
            "failed_output_file": str(failed_file) if failed_file else None,
            "local_seed_file": None,
            "classified_entries": success_entries,
        }
