"""
Analysis Agent - Main agent class
"""
import datetime
import uuid
from pathlib import Path
from .graph import build_analysis_graph
from ...models import AnalysisState


class AnalysisAgent:
    """
    Analysis Agent for detailed vulnerability analysis
    
    This agent:
    1. Fetches classified vulnerabilities from API
    2. Splits them into manageable chunks
    3. Performs deep taint flow analysis using LLM + MCP
    4. Generates detailed reports with PoC and recommendations
    5. Saves results to JSON files
    """
    
    def __init__(
        self,
        llm,
        mcp_client,
        provider: str = "unknown",
        classification_source: str = "http",
        classification_file: str | None = None,
        ignore_previous_versions: bool = False,
        target_label: str | None = None,
        target_cwe: str | None = None,
        system_prompt: str | None = None,
        target_is_general: bool = False,
    ):
        self.llm = llm
        self.mcp_client = mcp_client
        self.provider = provider
        self.classification_source = (classification_source or "http").lower()
        self.classification_file = classification_file
        self.ignore_previous_versions = ignore_previous_versions
        self.target_label = target_label
        self.target_cwe = target_cwe
        self.system_prompt = system_prompt
        self.target_is_general = target_is_general
        self.graph = build_analysis_graph(llm, mcp_client, provider)
        self.graph.get_graph(xray=False).draw_mermaid_png(
            background_color="white",
            output_file_path=datetime.datetime.now().strftime("analysis_agent_graph_%Y%m%d_%H%M%S.png")
        )


    
    async def analyze(self, project_title: str, worker_id: int = 0, worker_count: int = 1, callbacks: list | None = None) -> dict:
        """
        Run analysis workflow
        
        Args:
            project_title: Project title for API
        
        Returns:
            Analysis results
        """
        classification_file = self.classification_file
        if self.classification_source == "json":
            default_file = Path("discovery_results") / f"{project_title}_discovery.json"
            classification_file = classification_file or str(default_file)
            print(f"📂 Using local discovery results: {classification_file}")

        print(f"[DEBUG] Starting AnalysisAgent.analyze for worker={worker_id} of {worker_count}")
        initial_state: AnalysisState = {
            "project_title": project_title,
            "classification_source": self.classification_source,
            "classification_file": classification_file,
            "ignore_previous_versions": self.ignore_previous_versions,
            "target_label": self.target_label,
            "target_cwe": self.target_cwe,
            "system_prompt": self.system_prompt,
            "target_is_general": self.target_is_general,
            "classified_elements": [],
            "total_elements": 0,
            "processed_count": 0,
            "current_batch": [],
            "analyzed_batch": [],
            "all_analyzed": [],
            "analyzed_keys": set(),
            "failed_elements": [],
            "failed_retry_count": 0,
            "messages": [],
            "current_stage": "init",
            "worker_id": worker_id,
            "worker_count": worker_count,
        }
        print(f"[DEBUG] Initial failed_retry_count={initial_state['failed_retry_count']}, state_id={id(initial_state)}")
        
        # Run graph with sufficient recursion limit
        # Calculation:
        # - Worst case: 3 elements per batch (large JSON data)
        # - 1500 elements ÷ 3 = 500 batches
        # - Each batch: 5 nodes (prepare → analyze → save → check → loop)
        # - Total: 500 batches × 5 nodes = 2500 iterations
        # - Safety margin: 3000 (allows for some failed retries)
        thread_id = f"analysis::{project_title}::{uuid.uuid4().hex}"
        
        invoke_config = {
            "recursion_limit": 3000,
            "configurable": {
                "thread_id": thread_id
            }
        }
        if callbacks:
            invoke_config["callbacks"] = callbacks
            
        result = await self.graph.ainvoke(
            initial_state,
            config=invoke_config
        )
        
        return {
            # "project_title": project_title,
            "total_analyzed": result.get("processed_count", 0),
            # "messages": result.get("messages", []),
            "stage": result.get("current_stage"),
            # "analysis_output_file": str(Path("analysis_results") / f"{project_title}_latest.json")
        }
