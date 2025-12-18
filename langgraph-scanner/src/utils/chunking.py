"""
Utility functions for chunking data
"""
import json
from typing import List, Dict, Any
from ..config import MAX_CHUNK_SIZE


def split_elements_into_chunks(
    elements: List[Dict[str, Any]], 
    max_chars: int = MAX_CHUNK_SIZE
) -> List[List[Dict[str, Any]]]:
    """
    Split list of elements into chunks that fit within max_chars limit
    
    Important: Ensures each chunk contains complete JSON objects, not partial ones
    
    Args:
        elements: List of elements to split
        max_chars: Maximum characters per chunk (default: 3000)
    
    Returns:
        List of element chunks
    
    Example:
        elements = [{"a": 1}, {"b": 2}, {"c": 3}]
        chunks = split_elements_into_chunks(elements, max_chars=50)
        # Result: [[{"a": 1}, {"b": 2}], [{"c": 3}]]
    """
    if not elements:
        return []
    
    chunks = []
    current_chunk = []
    
    for element in elements:
        # Try adding element to current chunk
        test_chunk = current_chunk + [element]
        test_json = json.dumps(test_chunk, ensure_ascii=False)
        
        if len(test_json) <= max_chars:
            # Fits in current chunk
            current_chunk.append(element)
        else:
            # Doesn't fit - save current chunk and start new one
            if current_chunk:
                chunks.append(current_chunk)
            
            # Start new chunk with this element
            current_chunk = [element]
            
            # Sanity check: if single element exceeds max_chars, include it anyway
            single_json = json.dumps([element], ensure_ascii=False)
            if len(single_json) > max_chars:
                print(f"⚠️  Warning: Single element exceeds {max_chars} chars ({len(single_json)} chars)")
    
    # Don't forget last chunk
    if current_chunk:
        chunks.append(current_chunk)
    
    return chunks


def get_chunk_stats(chunks: List[List[Dict[str, Any]]]) -> Dict[str, Any]:
    """
    Get statistics about chunks
    
    Args:
        chunks: List of element chunks
    
    Returns:
        Dictionary with chunk statistics
    """
    if not chunks:
        return {
            "num_chunks": 0,
            "total_elements": 0,
            "min_chunk_size": 0,
            "max_chunk_size": 0,
            "avg_chunk_size": 0,
            "min_json_length": 0,
            "max_json_length": 0,
            "avg_json_length": 0
        }
    
    chunk_sizes = [len(chunk) for chunk in chunks]
    json_lengths = [len(json.dumps(chunk, ensure_ascii=False)) for chunk in chunks]
    
    return {
        "num_chunks": len(chunks),
        "total_elements": sum(chunk_sizes),
        "min_chunk_size": min(chunk_sizes),
        "max_chunk_size": max(chunk_sizes),
        "avg_chunk_size": sum(chunk_sizes) / len(chunks),
        "min_json_length": min(json_lengths),
        "max_json_length": max(json_lengths),
        "avg_json_length": sum(json_lengths) / len(chunks)
    }
