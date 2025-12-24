from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class ProjectStatus(str, Enum):
    active = "active"
    inactive = "inactive"
    archived = "archived"

class ProjectTriggerMode(str, Enum):
    web = "web"
    git = "git"

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    description: Optional[str] = Field(None, max_length=1000, description="Project description")
    team_id: Optional[int] = Field(None, description="Team ID (optional)")
    trigger_mode: ProjectTriggerMode = Field(default=ProjectTriggerMode.web, description="Scan trigger mode (web/manual or git webhook)")
    git_url: Optional[str] = Field(None, max_length=500, description="Repository URL for git-triggered projects")
    git_branch: Optional[str] = Field(None, max_length=255, description="Branch name for git-triggered projects")
    webhook_secret: Optional[str] = Field(None, max_length=255, description="Optional webhook secret for git triggers")
    default_scan_mode: Optional[str] = Field('custom', description="Default scan mode: 'preset' or 'custom'")
    default_profile_mode: Optional[str] = Field('preset', description="Default profile mode: 'preset' or 'custom'")
    default_provider: Optional[str] = Field('groq', description="Default LLM Provider (e.g., groq, openai)")
    default_model: Optional[str] = Field('llama3-70b-8192', description="Default LLM Model Name")

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    status: Optional[ProjectStatus] = None
    team_id: Optional[int] = None
    trigger_mode: Optional[ProjectTriggerMode] = None
    git_url: Optional[str] = Field(None, max_length=500)
    git_branch: Optional[str] = Field(None, max_length=255)
    webhook_secret: Optional[str] = Field(None, max_length=255)
    jenkins_job_name: Optional[str] = Field(None, max_length=255)
    jenkins_job_url: Optional[str] = Field(None, max_length=500)
    webhook_url: Optional[str] = Field(None, max_length=500)
    default_scan_mode: Optional[str] = Field(None, description="Default scan mode for git triggers: 'preset' (Quick Scan), 'custom' (Full Scan)")
    default_profile_mode: Optional[str] = Field(None, description="Default profile mode for git triggers: 'preset' (기본 설정), 'custom' (고급 설정)")
    default_provider: Optional[str] = Field(None, description="Default LLM Provider")
    default_model: Optional[str] = Field(None, description="Default LLM Model")

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    user_id: int
    team_id: Optional[int] = None
    status: str
    created_at: datetime
    updated_at: datetime
    last_scan_at: Optional[datetime] = None
    total_scans: int
    total_vulnerabilities: int
    trigger_mode: ProjectTriggerMode
    git_url: Optional[str] = None
    git_branch: Optional[str] = None
    jenkins_job_name: Optional[str] = None
    jenkins_job_url: Optional[str] = None
    webhook_secret: Optional[str] = None
    webhook_url: Optional[str] = None
    default_scan_mode: Optional[str] = None
    default_profile_mode: Optional[str] = None
    default_provider: Optional[str] = None
    default_model: Optional[str] = None

    class Config:
        from_attributes = True

