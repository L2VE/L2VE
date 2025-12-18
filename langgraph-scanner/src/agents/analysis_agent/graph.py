"""
Analysis Agent - Detailed vulnerability analysis with taint flow
"""
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command
from langgraph.checkpoint.memory import MemorySaver
from ...models import AnalysisState
from . import nodes


def build_analysis_graph(llm, mcp_client, provider: str = "unknown", checkpointer=None):
    """
    Build Analysis Agent graph
    
    Workflow:
    1. fetch_classified: Fetch classified vulnerabilities from API
    2. prepare_batch: Split into chunks for analysis
    3. analyze_batch: Deep taint analysis with MCP tools
    4. save_results: Save detailed analysis results
    5. check_completion: Check if all elements analyzed
    
    Args:
        llm: Language model instance
        mcp_client: MCP client for source code browsing
        provider: LLM provider name (google/groq/openai)
    
    Returns:
        Compiled StateGraph
    """
    workflow = StateGraph(AnalysisState)
    
    # Create async wrapper for analyze_batch
    async def analyze_batch_wrapper(state: AnalysisState):
        return await nodes.analyze_batch(state, llm, mcp_client, provider)
    
    # Add nodes
    workflow.add_node("fetch_classified", lambda state: nodes.fetch_classified(state))
    workflow.add_node("prepare_batch", lambda state: nodes.prepare_batch(state))
    workflow.add_node("analyze_batch", analyze_batch_wrapper)
    workflow.add_node("save_results", lambda state: nodes.save_results(state))
    workflow.add_node("check_completion", lambda state: nodes.check_completion(state))
    
    # Define edges
    workflow.add_edge(START, "fetch_classified")
    
    # Conditional edge from fetch_classified: if completed, skip to end
    workflow.add_conditional_edges(
        "fetch_classified",
        lambda state: "continue" if state.get("current_stage") not in ["completed", "error"] else "done",
        {
            "continue": "prepare_batch",
            "done": END
        }
    )
    
    workflow.add_edge("prepare_batch", "analyze_batch")
    workflow.add_edge("analyze_batch", "save_results")
    workflow.add_edge("save_results", "check_completion")
    
    # Conditional edge from check_completion
    workflow.add_conditional_edges(
        "check_completion",
        lambda state: "continue" if state.get("current_stage") == "processing" else "done",
        {
            "continue": "prepare_batch",  # Loop back for next batch
            "done": END
        }
    )
    
    memory = checkpointer or MemorySaver()
    return workflow.compile(checkpointer=memory)
