"""
API utilities for interacting with vulnerability management server
"""
import httpx
import json
from typing import List, Dict, Any, Optional
from ..config import API_BASE_URL


async def fetch_unseen_vulnerabilities(project_title: str) -> List[Dict[str, Any]]:
    """
    Fetch unseen vulnerability elements from API
    
    Args:
        project_title: Project title
    
    Returns:
        List of unseen vulnerability elements
    """
    url = f"{API_BASE_URL}/projects/{project_title}/vulns/unseen"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url, headers={"Content-Type": "application/json"})
            response.raise_for_status()
            unseen_list = response.json()
            print(f"✅ Fetched {len(unseen_list)} unseen elements from API")
            return unseen_list
        except httpx.HTTPError as e:
            print(f"❌ API Error: {e}")
            return []
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            return []


async def batch_update_vulnerabilities(
    project_title: str, 
    data: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Batch update vulnerability classifications
    
    Args:
        project_title: Project title
        data: List of classified vulnerability elements
    
    Returns:
        API response with update statistics
    """
    url = f"{API_BASE_URL}/projects/{project_title}/vulns/batch-update"
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.patch(
                url,
                headers={"Content-Type": "application/json"},
                json=data
            )
            response.raise_for_status()
            result = response.json()
            print(f"✅ Batch update completed: {result}")
            return result
        except httpx.HTTPError as e:
            print(f"❌ Batch update error: {e}")
            return {"error": str(e)}
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            return {"error": str(e)}


async def fetch_classified_vulnerabilities(project_title: str) -> List[Dict[str, Any]]:
    """
    Fetch all classified vulnerabilities from API
    
    Args:
        project_title: Project title
    
    Returns:
        List of classified vulnerability elements
    """
    url = f"{API_BASE_URL}/projects/{project_title}/vulns/actual"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url, headers={"Content-Type": "application/json"})
            response.raise_for_status()
            vulns_list = response.json()
            print(f"✅ Fetched {len(vulns_list)} classified vulnerabilities from API")
            return vulns_list
        except httpx.HTTPError as e:
            print(f"❌ API Error: {e}")
            return []
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            return []
