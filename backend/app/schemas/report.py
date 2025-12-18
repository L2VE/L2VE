from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

class ReportStatus(str, Enum):
    generating = "generating"
    completed = "completed"
    failed = "failed"

class ReportCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    report_type: str = Field(..., min_length=1, max_length=100)
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None

class ReportUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[ReportStatus] = None
    summary: Optional[str] = None
    report_data: Optional[Dict[str, Any]] = None
    file_path: Optional[str] = None

class ReportResponse(BaseModel):
    id: int
    project_id: int
    title: str
    report_type: str
    status: str
    scan_count: int
    vulnerabilities_found: int
    summary: Optional[str] = None
    report_data: Optional[Dict[str, Any]] = None
    file_path: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    created_at: datetime
    generated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

