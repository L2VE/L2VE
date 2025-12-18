"""
Jenkins 연동 라우터
- 빌드 로그 조회
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.utils.auth import get_current_user
from app.utils.permissions import check_project_access
from app.utils.jenkins_client import JenkinsClient
from app.utils.jenkins_log_parser import parse_jenkins_log, extract_build_info
from app.models.user import User
from app.models.scan import Scan

router = APIRouter(prefix="/api/projects/{project_id}/scans", tags=["jenkins"])


@router.get("/{scan_id}/pipeline")
async def get_pipeline_logs(
    project_id: int,
    scan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Jenkins 파이프라인 로그 조회 및 파싱
    
    Returns:
        - stages: 각 단계별 정보
        - summary: 전체 요약
        - build_info: 빌드 메타데이터
    """
    # 권한 확인
    check_project_access(db, current_user, project_id)
    
    # Scan 조회
    scan = db.query(Scan).filter(
        Scan.id == scan_id,
        Scan.project_id == project_id
    ).first()
    
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found"
        )
    
    # scan_results에서 build_url 추출
    build_url = None
    if scan.scan_results and isinstance(scan.scan_results, dict):
        build_url = scan.scan_results.get('build_url')
        build_number = scan.scan_results.get('build_number')
    
    if not build_url:
        return {
            "available": False,
            "message": "Jenkins build URL not available"
        }
    
    # Jenkins API로 로그 가져오기
    try:
        client = JenkinsClient()
        # build_url에서 job_name과 build_number 추출
        # 예: http://113.198.66.77:10218/job/sunday/10/
        import re
        match = re.search(r'/job/([^/]+)/(\d+)', build_url)
        if not match:
            raise ValueError(f"Invalid build URL format: {build_url}")
        
        job_name = match.group(1)
        build_num = match.group(2)
        
        # Jenkins console 로그 가져오기
        log_url = f"{client.base_url}/job/{job_name}/{build_num}/consoleText"
        print(f"[DEBUG] Fetching logs from: {log_url}")  # 디버깅
        
        response = client.session.get(log_url, timeout=15)
        
        if response.status_code != 200:
            print(f"[ERROR] Jenkins returned status {response.status_code}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Jenkins returned status {response.status_code}"
            )
        
        log_text = response.text
        print(f"[DEBUG] Log length: {len(log_text)} chars")  # 디버깅
        
        # 로그가 비어있는지 확인
        if not log_text.strip():
            return {
                "available": False,
                "message": "Jenkins log is empty",
                "build_url": build_url
            }
        
        # 로그 파싱
        parsed = parse_jenkins_log(log_text)
        build_info = extract_build_info(log_text)
        
        print(f"[DEBUG] Parsed {len(parsed['stages'])} stages")  # 디버깅
        
        return {
            "available": True,
            "build_url": build_url,
            "build_number": build_num,
            "job_name": job_name,
            "stages": parsed["stages"],
            "summary": parsed["summary"],
            "build_info": build_info,
            "errors": parsed["errors"],
            "warnings": parsed["warnings"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"{type(e).__name__}: {str(e)}"
        print(f"[ERROR] {error_detail}")
        print(traceback.format_exc())
        
        return {
            "available": False,
            "message": error_detail,
            "build_url": build_url
        }
