from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.database import Base

class Scan(Base):
    __tablename__ = "scans"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    scan_type = Column(String(100), nullable=False)  # full, api, auth, sqli, xss, etc.
    status = Column(Enum('pending', 'running', 'completed', 'failed', name='scan_status'), default='pending', index=True)
    
    # Scan results
    vulnerabilities_found = Column(Integer, default=0)
    critical = Column(Integer, default=0)
    high = Column(Integer, default=0)
    medium = Column(Integer, default=0)
    low = Column(Integer, default=0)
    
    # Additional data
    scan_config = Column(JSON, nullable=True)  # 스캔 설정 (JSON)
    scan_results = Column(JSON, nullable=True)  # 상세 결과 (JSON)
    error_message = Column(Text, nullable=True)  # 에러 메시지
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

