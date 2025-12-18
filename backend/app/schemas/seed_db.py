from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class SeedDBItem(BaseModel):
    """seed_db 항목 스키마"""
    file_path: str = Field(..., description="파일 경로")
    line_num: str = Field(..., description="라인 번호 (단일: '45' 또는 범위: '45-50')")
    code_snippet: Optional[str] = Field(None, description="코드 스니펫")
    vulnerability_types: Optional[List[str]] = Field(None, description="취약점 타입 배열 (예: ['XSS', 'SSRF'])")
    hasSeen: Optional[bool] = Field(None, description="Discovery Agent가 이미 처리했는지 여부")
    analysis_result: Optional[Dict[str, Any]] = Field(None, description="Analysis Agent의 상세 분석 결과")


class SeedDBBatchUpdate(BaseModel):
    """seed_db 배치 업데이트 스키마"""
    file_path: str
    line_num: str
    code_snippet: Optional[str] = None
    vulnerability_types: Optional[List[str]] = None
    hasSeen: Optional[bool] = None
    analysis_result: Optional[Dict[str, Any]] = None


class SeedDBBatchUpdateRequest(BaseModel):
    """seed_db 배치 업데이트 요청 스키마"""
    items: List[SeedDBBatchUpdate]


class SeedDBBatchUpdateResponse(BaseModel):
    """seed_db 배치 업데이트 응답 스키마"""
    updated: int
    success: bool

