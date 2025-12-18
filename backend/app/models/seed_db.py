from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.database import Base

# 기존 Base 사용 (같은 데이터베이스 연결)


class SeedDB(Base):
    """
    seed_db 테이블 모델 (PostgreSQL)
    Semgrep으로 발견된 취약점 시드 데이터를 저장
    """
    __tablename__ = "seed_db"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_title = Column(String(255), nullable=False, index=True)
    vulnerability_types = Column(JSONB, default=[], nullable=False)
    file_path = Column(String(500), nullable=False)
    line_num = Column(String(50), nullable=False)
    code_snippet = Column(Text, nullable=True)
    hasSeen = Column(Boolean, name='hasseen', default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Unique constraint는 __table_args__로 정의
    __table_args__ = (
        Index('idx_seed_db_unique', 'project_title', 'file_path', 'line_num', unique=True),
        Index('idx_seed_db_project_title', 'project_title'),
        Index('idx_seed_db_file_path', 'file_path'),
        Index('idx_seed_db_hasSeen', 'hasseen'),
    )

