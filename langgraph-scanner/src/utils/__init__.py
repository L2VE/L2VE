"""Utils module"""
from .api_client import (
    fetch_unseen_vulnerabilities,
    batch_update_vulnerabilities,
    fetch_classified_vulnerabilities
)
from .chunking import (
    split_elements_into_chunks,
    get_chunk_stats
)
__all__ = [
    "fetch_unseen_vulnerabilities",
    "batch_update_vulnerabilities",
    "fetch_classified_vulnerabilities",
    "split_elements_into_chunks",
    "get_chunk_stats"
]
