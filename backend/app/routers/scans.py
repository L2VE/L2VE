from fastapi import APIRouter, Depends, status, HTTPException, Header, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.schemas.scan import ScanCreate, ScanUpdate, ScanResponse, TriggerScanRequest, TriggerScanResponse, IngestScanResults, ScanProgressUpdate
from app.schemas.analysis_result import AnalysisResultResponse
from app.services.scan_service import ScanService
from app.utils.auth import get_current_user
from app.models.user import User
from app.models.scan import Scan
from app.models.vulnerability import Vulnerability
from app.models.analysis_result import AnalysisResult
from app.utils.permissions import check_project_access
from app.config import get_settings
import os
import shutil
from pathlib import Path

router = APIRouter(prefix="/api/projects/{project_id}/scans", tags=["Scans"])

@router.post("/", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
async def create_scan(
    project_id: int,
    scan_data: ScanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new scan for a project
    
    Security:
        - Requires member or higher role on project
    """
    scan = ScanService.create_scan(db, scan_data, project_id, current_user)
    return scan

@router.get("/", response_model=List[ScanResponse])
async def get_scans(
    project_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all scans for a project
    
    Security:
        - Requires viewer or higher role on project
    """
    scans = ScanService.get_project_scans(db, project_id, current_user, skip, limit)
    return scans

@router.get("/{scan_id}", response_model=ScanResponse)
async def get_scan(
    project_id: int,
    scan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific scan
    
    Security:
        - Requires viewer or higher role on project
        - IDOR prevention
    """
    scan = ScanService.get_scan_by_id(db, scan_id, project_id, current_user)
    return scan

@router.put("/{scan_id}", response_model=ScanResponse)
async def update_scan(
    project_id: int,
    scan_id: int,
    scan_data: ScanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a scan
    
    Security:
        - Requires member or higher role on project
    """
    scan = ScanService.update_scan(db, scan_id, project_id, current_user, scan_data)
    return scan

@router.delete("/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scan(
    project_id: int,
    scan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a scan
    
    Security:
        - Requires admin or higher role on project
    """
    ScanService.delete_scan(db, scan_id, project_id, current_user)
    return None

@router.post("/{scan_id}/start", response_model=ScanResponse)
async def start_scan(
    project_id: int,
    scan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Start a pending scan
    
    Security:
        - Requires member or higher role on project
    """
    scan = ScanService.start_scan(db, scan_id, project_id, current_user)
    return scan

@router.post("/upload", status_code=status.HTTP_200_OK)
async def upload_project_file(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a project ZIP file for scanning
    
    Security:
        - Requires member or higher role on project
    """
    check_project_access(db, current_user, project_id)
    
    # 파일 확장자 검증
    if not file.filename.endswith('.zip'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only ZIP files are allowed"
        )
    
    # 파일 크기 검증 (최대 500MB)
    max_size = 500 * 1024 * 1024  # 500MB
    file.file.seek(0, 2)  # 파일 끝으로 이동
    file_size = file.file.tell()
    file.file.seek(0)  # 파일 시작으로 복귀
    
    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed size of {max_size // (1024 * 1024)}MB"
        )
    
    # 업로드 디렉토리 생성
    upload_dir = Path("/tmp/l2ve_uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # 프로젝트 이름 추출 (파일명에서 .zip 제거)
    project_name = file.filename.rsplit('.', 1)[0]
    
    # 파일 저장
    file_path = upload_dir / f"{project_id}_{project_name}_{file.filename}"
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
    
    return {
        "file_path": str(file_path),
        "project_name": project_name,
        "file_size": file_size,
        "message": "File uploaded successfully"
    }

@router.post("/trigger", response_model=ScanResponse)
async def trigger_scan(
    project_id: int,
    payload: TriggerScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Trigger Jenkins pipeline to run a scan for this project.
    """
    # source_type 자동 감지 (없는 경우)
    if not payload.source_type:
        if payload.uploaded_file_path:
            payload.source_type = "upload"
        elif payload.github_url:
            payload.source_type = "git"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either source_type must be specified, or uploaded_file_path (for upload) or github_url (for git) must be provided"
            )
    
    # source_type 검증
    if payload.source_type == "upload" and not payload.uploaded_file_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="uploaded_file_path is required when source_type is 'upload'"
        )
    
    if payload.source_type == "git" and not payload.github_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="github_url is required when source_type is 'git'"
        )
    
    scan = ScanService.trigger_jenkins_scan(db, project_id, current_user, payload)
    return scan

@router.post("/{scan_id}/ingest", response_model=ScanResponse)
async def ingest_scan_results(
    project_id: int,
    scan_id: int,
    payload: IngestScanResults,
    db: Session = Depends(get_db),
    jenkins_secret: str | None = Header(default=None, alias="X-Jenkins-Token"),
    api_key: str | None = Header(default=None, alias="X-Api-Key")
):
    """
    Jenkins callback to ingest results JSON.
    Uses X-Jenkins-Token header for shared-secret validation.
    """
    settings = get_settings()

    # Validate API key and Jenkins secret (둘 다 설정되어 있을 때만 검증)
    if settings.BACKEND_SERVICE_API_KEY:
        if settings.BACKEND_SERVICE_API_KEY != (api_key or ""):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")
    
    if settings.JENKINS_CALLBACK_SECRET:
        if settings.JENKINS_CALLBACK_SECRET != (jenkins_secret or ""):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Jenkins secret")

    scan = ScanService.ingest_results(
        db=db,
        project_id=project_id,
        scan_id=scan_id,
        payload=payload,
        callback_secret_header=jenkins_secret or "",
        expected_secret=settings.JENKINS_CALLBACK_SECRET or "",
    )
    return scan

@router.patch("/{scan_id}/progress", response_model=ScanResponse)
async def update_scan_progress(
    project_id: int,
    scan_id: int,
    payload: ScanProgressUpdate,
    db: Session = Depends(get_db),
    jenkins_secret: str | None = Header(default=None, alias="X-Jenkins-Token"),
    api_key: str | None = Header(default=None, alias="X-Api-Key")
):
    """
    Jenkins 파이프라인에서 진행 상황을 업데이트합니다.
    Uses X-Jenkins-Token header for shared-secret validation.
    """
    settings = get_settings()

    # Validate API key and Jenkins secret
    if settings.BACKEND_SERVICE_API_KEY:
        if settings.BACKEND_SERVICE_API_KEY != (api_key or ""):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")
    
    if settings.JENKINS_CALLBACK_SECRET:
        if settings.JENKINS_CALLBACK_SECRET != (jenkins_secret or ""):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Jenkins secret")

    scan = ScanService.update_progress(
        db=db,
        project_id=project_id,
        scan_id=scan_id,
        payload=payload,
    )
    return scan

# ===== 새로운 엔드포인트: 취약점 조회 =====

@router.get("/{scan_id}/vulnerabilities")
async def get_scan_vulnerabilities(
    project_id: int,
    scan_id: int,
    severity: Optional[str] = None,
    cwe: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    특정 스캔의 취약점 목록 조회
    
    Parameters:
        - severity: 심각도 필터 (critical, high, medium, low)
        - cwe: CWE 필터 (예: CWE-601)
    
    Security:
        - Requires project access
    """
    # 프로젝트 접근 권한 확인
    check_project_access(db, current_user, project_id)
    
    # 스캔 존재 여부 확인
    scan = db.query(Scan).filter(
        Scan.id == scan_id,
        Scan.project_id == project_id
    ).first()
    
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found"
        )
    
    # 쿼리 빌드
    query = db.query(Vulnerability).filter(
        Vulnerability.scan_id == scan_id,
        Vulnerability.project_id == project_id
    )
    
    # 필터 적용
    if severity:
        query = query.filter(Vulnerability.severity == severity.lower())
    if cwe:
        query = query.filter(Vulnerability.cwe == cwe.upper())
    
    # 결과 반환 (심각도 순으로 정렬)
    vulnerabilities = query.order_by(
        Vulnerability.severity.desc(),
        Vulnerability.discovered_at.desc()
    ).all()
    
    return vulnerabilities


@router.get("/{scan_id}/analysis-results", response_model=List[AnalysisResultResponse])
async def get_scan_analysis_results(
    project_id: int,
    scan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    특정 스캔의 정규화된 분석 결과(taint flow 포함)를 조회합니다.
    """
    check_project_access(db, current_user, project_id)

    scan = db.query(Scan).filter(
        Scan.id == scan_id,
        Scan.project_id == project_id
    ).first()

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found"
        )

    # 일관성을 위해 scan_id와 project_id 모두 확인
    # (AnalysisResult에는 project_id가 없지만, scan을 통해 간접적으로 검증됨)
    # 추가 방어: scan이 해당 project_id에 속하는지 이미 확인했으므로 안전함
    results = (
        db.query(AnalysisResult)
        .filter(AnalysisResult.scan_id == scan_id)
        .order_by(AnalysisResult.created_at.asc(), AnalysisResult.id.asc())
        .all()
    )
    return results

@router.get("/{scan_id}/vulnerabilities/stats")
async def get_vulnerability_stats(
    project_id: int,
    scan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    스캔의 취약점 통계 조회
    
    Returns:
        - OWASP Top 10 매핑
        - Attack Vector 분포
        - 파일 핫스팟
    
    Security:
        - Requires project access
    """
    check_project_access(db, current_user, project_id)
    
    # 스캔 존재 확인
    scan = db.query(Scan).filter(
        Scan.id == scan_id,
        Scan.project_id == project_id
    ).first()
    
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found"
        )
    
    # CWE 통계
    cwe_stats = db.query(
        Vulnerability.cwe,
        func.count(Vulnerability.id).label('count')
    ).filter(
        Vulnerability.scan_id == scan_id
    ).group_by(Vulnerability.cwe).all()
    
    # 파일 핫스팟
    from sqlalchemy import func, case
    file_hotspots = db.query(
        Vulnerability.file_path,
        func.count(Vulnerability.id).label('total_count'),
        func.sum(case((Vulnerability.severity == 'critical', 1), else_=0)).label('critical_count'),
        func.sum(case((Vulnerability.severity == 'high', 1), else_=0)).label('high_count'),
        func.sum(case((Vulnerability.severity == 'medium', 1), else_=0)).label('medium_count'),
        func.sum(case((Vulnerability.severity == 'low', 1), else_=0)).label('low_count'),
        func.max(Vulnerability.severity).label('max_severity')
    ).filter(
        Vulnerability.scan_id == scan_id,
        Vulnerability.file_path.isnot(None)
    ).group_by(Vulnerability.file_path).order_by(
        func.count(Vulnerability.id).desc()
    ).limit(10).all()
    
    # OWASP Top 10 매핑 (CWE 기반)
    owasp_mapping = {
        'A01': ['CWE-639', 'CWE-284', 'CWE-285', 'CWE-352'],  # Broken Access Control
        'A03': ['CWE-79', 'CWE-89', 'CWE-94', 'CWE-95'],       # Injection
        'A05': ['CWE-16', 'CWE-209', 'CWE-200'],               # Security Misconfiguration
        'A07': ['CWE-287', 'CWE-288', 'CWE-290'],              # Identification Failures
        'A10': ['CWE-918']                                      # SSRF
    }
    
    owasp_stats = {}
    for owasp_id, cwe_list in owasp_mapping.items():
        count = db.query(Vulnerability).filter(
            Vulnerability.scan_id == scan_id,
            Vulnerability.cwe.in_(cwe_list)
        ).count()
        if count > 0:
            owasp_stats[owasp_id] = count
    
    # Attack Vector 분류
    attack_vector_mapping = {
        'XSS': ['CWE-79', 'CWE-80', 'CWE-81'],
        'SSRF': ['CWE-918'],
        'IDOR': ['CWE-639', 'CWE-284'],
        'Open Redirect': ['CWE-601'],
        'SQL Injection': ['CWE-89'],
        'Command Injection': ['CWE-78']
    }
    
    attack_vector_stats = {}
    for vector, cwe_list in attack_vector_mapping.items():
        count = db.query(Vulnerability).filter(
            Vulnerability.scan_id == scan_id,
            Vulnerability.cwe.in_(cwe_list)
        ).count()
        if count > 0:
            attack_vector_stats[vector] = count
    
    return {
        "cwe_distribution": [{"cwe": item[0], "count": item[1]} for item in cwe_stats],
        "file_hotspots": [
            {
                "file_path": item[0],
                "total_count": item[1],
                "critical": item[2],
                "high": item[3],
                "medium": item[4],
                "low": item[5],
                "max_severity": item[6]
            } for item in file_hotspots
        ],
        "owasp_top10": owasp_stats,
        "attack_vectors": attack_vector_stats
    }

# ===== Jenkins Auto-Scan Endpoint =====


