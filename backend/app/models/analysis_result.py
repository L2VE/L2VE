from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.database import Base


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    scan_id = Column(Integer, ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True)
    project_title = Column(String(255), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    line_num = Column(String(50), nullable=True)
    vulnerability_title = Column(Text, nullable=False)
    severity = Column(String(20), nullable=True, index=True)
    cwe = Column(String(50), nullable=True, index=True)
    description = Column(Text, nullable=True)
    taint_flow = Column(JSON, nullable=True)
    proof_of_concept = Column(JSON, nullable=True)
    recommendation = Column(JSON, nullable=True)
    functional_test = Column(JSON, nullable=True)
    security_regression_test = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


