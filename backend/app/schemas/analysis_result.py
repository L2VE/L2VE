from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


class AnalysisResultResponse(BaseModel):
    id: int
    scan_id: int
    project_title: str
    file_path: str
    line_num: Optional[str] = None
    vulnerability_title: str
    severity: Optional[str] = None
    cwe: Optional[str] = None
    description: Optional[str] = None
    taint_flow: Optional[Dict[str, Any]] = None
    proof_of_concept: Optional[Dict[str, Any]] = None
    recommendation: Optional[Dict[str, Any]] = None
    functional_test: Optional[Dict[str, Any]] = None
    security_regression_test: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

