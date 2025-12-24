from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(Enum('active', 'inactive', 'archived', name='project_status'), default='active', index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_scan_at = Column(DateTime(timezone=True), nullable=True)
    total_scans = Column(Integer, default=0)
    total_vulnerabilities = Column(Integer, default=0)
    trigger_mode = Column(Enum('web', 'git', name='project_trigger_mode'), default='web', nullable=False, index=True)
    git_url = Column(String(500), nullable=True)
    git_branch = Column(String(255), nullable=True)
    jenkins_job_name = Column(String(255), nullable=True)
    jenkins_job_url = Column(String(500), nullable=True)
    webhook_secret = Column(String(255), nullable=True)
    webhook_url = Column(String(500), nullable=True)
    # Git commit 트리거 시 사용할 기본 스캔 설정
    default_scan_mode = Column(String(50), nullable=True, default='custom')  # 'preset' (Quick Scan), 'custom' (Full Scan)
    default_profile_mode = Column(String(50), nullable=True, default='preset')  # 'preset' (기본 설정), 'custom' (고급 설정)

    # 기본 LLM 설정 (Git 스캔용)
    default_provider = Column(String(50), nullable=True, default='groq')  # groq, openai 등
    default_model = Column(String(100), nullable=True, default='llama3-70b-8192')  # 특정 모델명
    
    # Relationships
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")

