from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class ScanStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"

class ScanCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    scan_type: str = Field(..., min_length=1, max_length=100)
    scan_config: Optional[Dict[str, Any]] = None

class TriggerScanRequest(BaseModel):
    github_url: Optional[str] = Field(None, min_length=1, description="Git repository URL (required if source_type is 'git')")
    source_type: Optional[str] = Field(None, description="'git' or 'upload' (auto-detected if not provided)")
    uploaded_file_path: Optional[str] = Field(None, description="서버에 저장된 업로드 파일 경로 (source_type이 'upload'일 때 필수)")
    project_name: Optional[str] = Field(None, description="프로젝트 이름 (파일 업로드 시 사용)")
    scan_type: str = Field(..., description="ALL, SSRF, RCE, XSS, SQLi, IDOR, PATH_TRAVERSAL, AUTH")
    api_provider: Optional[str] = Field(None, description="groq or openai (if None, use project defaults)")
    model: Optional[str] = Field(None, description="LLM Model Name (if None, use project defaults)")
    llm_endpoint_url: Optional[str] = Field(None, description="커스텀 LLM 엔드포인트 URL (옵션)")
    llm_api_key: Optional[str] = Field(None, description="커스텀 LLM API Key/Token (옵션)")
    run_sast: bool = Field(default=True)
    scan_mode: Optional[str] = Field(None, description="preset (Quick Scan), custom (Full Scan)")
    profile_mode: Optional[str] = Field(None, description="각 스캔 타입 내에서 preset (기본 설정) or custom (고급 설정)")
    notify_emails: Optional[List[str]] = Field(None, description="스캔 완료 알림을 보낼 이메일 목록")

class TriggerScanResponse(BaseModel):
    scan_id: int
    status: str
    jenkins_queue_url: Optional[str] = None

class IngestScanResults(BaseModel):
    project: Optional[str] = None
    scan_type: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    timestamp: Optional[str] = None
    build_number: Optional[str] = None
    status: Optional[str] = None
    content: Optional[str] = None
    reasoning: Optional[Dict[str, Any]] = None
    usage: Optional[Dict[str, Any]] = None
    tool_usage: Optional[Dict[str, Any]] = None
    artifact_url: Optional[str] = None
    build_url: Optional[str] = None
    # 새로운 형식 지원: 직접 vulnerabilities 배열
    vulnerability_count: Optional[int] = None
    vulnerabilities: Optional[List[Dict[str, Any]]] = None

class ScanUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[ScanStatus] = None
    vulnerabilities_found: Optional[int] = None
    critical: Optional[int] = None
    high: Optional[int] = None
    medium: Optional[int] = None
    low: Optional[int] = None
    scan_results: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

class ScanProgressUpdate(BaseModel):
    """Jenkins 파이프라인 진행 상황 업데이트용 스키마"""
    stage: str = Field(..., description="현재 진행 중인 stage 이름 (예: 'queue', 'checkout', 'analysis', 'upload')")
    status: str = Field(..., description="stage 상태 ('running', 'completed', 'failed')")
    message: Optional[str] = Field(None, description="추가 메시지")
    progress_percent: Optional[int] = Field(None, ge=0, le=100, description="전체 진행률 (0-100)")

class ScanResponse(BaseModel):
    id: int
    project_id: int
    name: str
    scan_type: str
    status: str
    vulnerabilities_found: int
    critical: int
    high: int
    medium: int
    low: int
    scan_config: Optional[Dict[str, Any]] = None
    scan_results: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
