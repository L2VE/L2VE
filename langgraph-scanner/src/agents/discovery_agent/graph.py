"""
Discovery Agent - Classify vulnerability seeds
"""
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command
from langgraph.checkpoint.memory import MemorySaver
from ...models import DiscoveryState
from . import nodes


def build_discovery_graph(
    llm,
    mcp_client,
    provider: str = "unknown",
    checkpointer=None,
    include_fetch: bool = True,
    include_update: bool = True,
):
    """
    Build Discovery Agent graph
    
    Workflow:
    1. fetch_unseen: Fetch unseen elements from API
    2. prepare_batch: Split into chunks and prepare batch
    3. classify_batch: LLM classifies vulnerability types with MCP tools
    4. update_api: Send classified results back to API
    5. check_completion: Check if all elements processed
    
    Args:
        llm: Language model instance
        mcp_client: MCP client for source code browsing
        provider: LLM provider name (google/groq/openai)
    
    Returns:
        Compiled StateGraph
    """
    workflow = StateGraph(DiscoveryState)
    
    # Create async wrapper for classify_batch
    async def classify_batch_wrapper(state: DiscoveryState):
        return await nodes.classify_batch(state, llm, mcp_client, provider)
    
    # Add nodes
    if include_fetch:
        workflow.add_node("fetch_unseen", lambda state: nodes.fetch_unseen(state))
    workflow.add_node("prepare_batch", lambda state: nodes.prepare_batch(state))
    workflow.add_node("classify_batch", classify_batch_wrapper)
    workflow.add_node("update_api", lambda state: nodes.update_api(state))
    workflow.add_node("check_completion", lambda state: nodes.check_completion(state))

    # Define edges
    start_node = "fetch_unseen" if include_fetch else "prepare_batch"
    workflow.add_edge(START, start_node)

    if include_fetch:
        workflow.add_conditional_edges(
            "fetch_unseen",
            lambda state: "continue" if state.get("current_stage") not in ["completed", "error"] else "done",
            {
                "continue": "prepare_batch",
                "done": END
            }
        )
    workflow.add_edge("prepare_batch", "classify_batch")

    if include_update:
        workflow.add_edge("classify_batch", "update_api")
        workflow.add_edge("update_api", "check_completion")
    else:
        workflow.add_edge("classify_batch", "check_completion")

    workflow.add_conditional_edges(
        "check_completion",
        lambda state: "continue" if state.get("current_stage") in ["processing", "checking"] else "done",
        {
            "continue": "fetch_unseen" if include_fetch else "prepare_batch",
            "done": END
        }
    )
    
    memory = checkpointer or MemorySaver()
    return workflow.compile(checkpointer=memory)
