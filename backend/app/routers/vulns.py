"""
Discovery/Analysis Agent용 엔드포인트
seed_db 테이블과 연동
"""
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from sqlalchemy.dialects.postgresql import JSONB
from typing import List, Union
import json

from app.database import get_db
from app.models.seed_db import SeedDB
from app.schemas.seed_db import (
    SeedDBItem,
    SeedDBBatchUpdate,
    SeedDBBatchUpdateRequest,
    SeedDBBatchUpdateResponse
)

router = APIRouter(prefix="/api/projects", tags=["vulns"])


@router.get("/{project_title}/vulns/unseen", response_model=List[SeedDBItem])
async def get_unseen_vulns(
    project_title: str,
    db: Session = Depends(get_db)
):
    """
    Discovery Agent가 처리할 seed 데이터 가져오기
    
    - project_title에 해당하는 항목 조회
    - hasSeen = false인 항목만 반환
    - vulnerability_types가 NULL이거나 빈 배열인 항목만 반환
    """
    try:
        # seed_db에서 unseen 항목 조회
        # vulnerability_types가 NULL이거나 빈 배열인 항목
        items = db.query(SeedDB).filter(
            and_(
                SeedDB.project_title == project_title,
                SeedDB.hasSeen == False
            )
        ).all()
        
        # Python에서 필터링 (JSONB는 이미 Python 객체로 변환됨)
        filtered_items = []
        for item in items:
            vuln_types = item.vulnerability_types
            if vuln_types is None or (isinstance(vuln_types, list) and len(vuln_types) == 0):
                filtered_items.append(item)
        
        items = filtered_items
        
        # 결과 변환
        result = []
        for item in items:
            # JSONB를 Python 리스트로 변환
            vuln_types = item.vulnerability_types
            if isinstance(vuln_types, str):
                try:
                    vuln_types = json.loads(vuln_types)
                except:
                    vuln_types = None
            # JSONB는 이미 Python 객체로 변환되어 있을 수 있음
            if vuln_types is None:
                vuln_types = None
            elif not isinstance(vuln_types, list):
                vuln_types = None
            
            result.append(SeedDBItem(
                file_path=item.file_path,
                line_num=item.line_num,
                code_snippet=item.code_snippet,
                vulnerability_types=vuln_types,
                hasSeen=item.hasSeen
            ))
        
        return result
    
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        error_msg = f"Failed to fetch unseen vulnerabilities: {str(e)}"
        logger.error(f"[VULNS] {error_msg}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )


@router.patch("/{project_title}/vulns/batch-update", response_model=SeedDBBatchUpdateResponse)
async def batch_update_vulns(
    project_title: str,
    payload: Union[SeedDBBatchUpdateRequest, List[SeedDBBatchUpdate]] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Discovery/Analysis Agent가 분류한 결과를 배치 업데이트
    
    - (project_title, file_path, line_num)로 매칭
    - vulnerability_types를 JSONB로 업데이트
    - hasSeen = true로 설정 (또는 요청값 사용)
    - analysis_result 업데이트 (Analysis Agent용)
    """
    updated_count = 0
    
    try:
        if isinstance(payload, list):
            items = payload
        else:
            items = payload.items

        if not items:
            return SeedDBBatchUpdateResponse(updated=0, success=True)

        for item in items:
            # 기존 항목 찾기
            seed_item = db.query(SeedDB).filter(
                and_(
                    SeedDB.project_title == project_title,
                    SeedDB.file_path == item.file_path,
                    SeedDB.line_num == item.line_num
                )
            ).first()
            
            if seed_item:
                # 업데이트
                if item.vulnerability_types is not None:
                    seed_item.vulnerability_types = item.vulnerability_types
                
                if item.hasSeen is not None:
                    seed_item.hasSeen = item.hasSeen
                elif item.vulnerability_types is not None:
                    # vulnerability_types가 업데이트되면 자동으로 hasSeen = true
                    seed_item.hasSeen = True
                
                if item.code_snippet is not None:
                    seed_item.code_snippet = item.code_snippet
                
                if item.analysis_result is not None:
                    # analysis_result는 별도 컬럼이 없으므로 vulnerability_types에 포함하거나
                    # 별도 처리가 필요할 수 있음 (현재는 vulnerability_types만 업데이트)
                    pass
                
                updated_count += 1
            else:
                # 새 항목 생성 (일반적으로는 Semgrep에서 이미 생성되어 있어야 함)
                new_item = SeedDB(
                    project_title=project_title,
                    file_path=item.file_path,
                    line_num=item.line_num,
                    code_snippet=item.code_snippet,
                    vulnerability_types=item.vulnerability_types or [],
                    hasSeen=item.hasSeen if item.hasSeen is not None else False
                )
                db.add(new_item)
                updated_count += 1
        
        db.commit()
        
        return SeedDBBatchUpdateResponse(
            updated=updated_count,
            success=True
        )
    
    except Exception as e:
        db.rollback()
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        error_msg = f"Failed to update vulnerabilities: {str(e)}"
        logger.error(f"[VULNS] {error_msg}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )


@router.get("/{project_title}/vulns/actual", response_model=List[SeedDBItem])
async def get_actual_vulns(
    project_title: str,
    db: Session = Depends(get_db)
):
    """
    Analysis Agent가 상세 분석할 분류된 취약점 가져오기
    
    - project_title에 해당하는 항목 조회
    - vulnerability_types에 "NO"가 포함되지 않은 항목만 반환
    - analysis_result가 NULL인 항목만 반환 (이미 분석된 것은 제외)
    """
    try:
        # seed_db에서 분류된 취약점 조회
        items = db.query(SeedDB).filter(
                and_(
                    SeedDB.project_title == project_title
                    # vulnerability_types 필터링은 Python에서 처리
                )
        ).all()
        
        # analysis_result가 NULL인 항목만 필터링
        # (현재 스키마에 analysis_result 컬럼이 없으므로, 일단 모든 항목 반환)
        # TODO: analysis_result 컬럼 추가 시 필터링 로직 추가
        
        # 결과 변환
        result = []
        for item in items:
            # JSONB를 Python 리스트로 변환
            vuln_types = item.vulnerability_types
            if isinstance(vuln_types, str):
                try:
                    vuln_types = json.loads(vuln_types)
                except:
                    vuln_types = []
            elif vuln_types is None:
                vuln_types = []
            
            # "NO"가 포함되어 있으면 제외
            if isinstance(vuln_types, list) and "NO" in vuln_types:
                continue
            
            result.append(SeedDBItem(
                file_path=item.file_path,
                line_num=item.line_num,
                code_snippet=item.code_snippet,
                vulnerability_types=vuln_types,
                hasSeen=item.hasSeen,
                analysis_result=None  # TODO: analysis_result 컬럼 추가 시 실제 값 반환
            ))
        
        return result
    
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        error_msg = f"Failed to fetch actual vulnerabilities: {str(e)}"
        logger.error(f"[VULNS] {error_msg}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )

