from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.database import Base

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    report_type = Column(String(100), nullable=False)  # monthly, vulnerability, compliance, custom
    status = Column(Enum('generating', 'completed', 'failed', name='report_status'), default='generating', index=True)
    
    # Report metadata
    scan_count = Column(Integer, default=0)  # 분석된 스캔 수
    vulnerabilities_found = Column(Integer, default=0)  # 발견된 취약점 수
    
    # Report content
    summary = Column(Text, nullable=True)  # 요약
    report_data = Column(JSON, nullable=True)  # 상세 리포트 데이터 (JSON)
    
    # File path (optional)
    file_path = Column(String(500), nullable=True)  # PDF/HTML 파일 경로
    
    # Date range for report
    date_from = Column(DateTime(timezone=True), nullable=True)
    date_to = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    generated_at = Column(DateTime(timezone=True), nullable=True)

