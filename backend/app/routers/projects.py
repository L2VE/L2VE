from fastapi import APIRouter, Depends, status, Header, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from app.database import get_db
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.services.project_service import ProjectService
from app.services.scan_service import ScanService
from app.schemas.scan import TriggerScanRequest, ScanResponse
from app.utils.auth import get_current_user
from app.models.user import User
from app.models.project import Project
from app.config import get_settings

router = APIRouter(prefix="/api/projects", tags=["Projects"])

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new project
    
    Security:
        - Requires authentication
        - Automatically adds creator as owner
    """
    # 현재 요청의 Hostname 전달 (Webhook URL 자동 생성용)
    request_host = request.url.hostname
    project = ProjectService.create_project(db, project_data, current_user.id, request_host=request_host)
    return project

@router.get("/", response_model=List[ProjectResponse])
async def get_projects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all projects accessible by the current user
    
    Security:
        - Returns only projects the user has access to
        - Superuser sees all projects
    """
    projects = ProjectService.get_user_projects_list(db, current_user, skip, limit)
    return projects

@router.get("/stats")
async def get_project_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get project statistics
    
    Security:
        - Statistics based only on accessible projects
    """
    stats = ProjectService.get_project_stats(db, current_user)
    return stats

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific project
    
    Security:
        - IDOR prevention: checks access permission
        - Returns 404 if no access
    """
    project = ProjectService.get_project_by_id(db, project_id, current_user)
    return project

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a project
    
    Security:
        - Requires admin or owner role
        - Input validation via Pydantic
    """
    project = ProjectService.update_project(db, project_id, current_user, project_data)
    return project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a project
    
    Security:
        - Requires owner role
        - Superuser can delete any project
    """
    ProjectService.delete_project(db, project_id, current_user)
    return None

@router.post("/auto-scan/git", status_code=status.HTTP_201_CREATED)
async def create_auto_scan_git(
    payload: TriggerScanRequest,
    db: Session = Depends(get_db),
    api_key: Optional[str] = Header(None, alias="X-Api-Key")
):
    """
    Git commit 이벤트로 자동 스캔 생성
    Jenkins webhook에서 호출됨
    
    Security:
        - API Key 인증 필요
        - Git URL로 프로젝트를 찾고 기본 설정으로 스캔 생성
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        settings = get_settings()
        expected_key = getattr(settings, "BACKEND_SERVICE_API_KEY", None)
        
        # 1. API Key 인증
        if not expected_key or api_key != expected_key:
            logger.warning(f"Invalid API key for auto-scan: provided={bool(api_key)}, expected={bool(expected_key)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing API key"
            )
        
        git_url = payload.github_url
        if not git_url:
             raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="github_url is required in payload"
            )

        logger.info(f"[AUTO-SCAN] Received request for git_url: {git_url}")
        
        # Git URL 디코딩 (URL 인코딩된 경우)
        import urllib.parse
        decoded_git_url = urllib.parse.unquote(git_url)
        logger.info(f"[AUTO-SCAN] Decoded git_url: {decoded_git_url}")
        
        # Git URL로 프로젝트 찾기 (정규화: .git 제거, URL 정규화)
        normalized_url = decoded_git_url.rstrip('/')
        if normalized_url.endswith('.git'):
            normalized_url = normalized_url[:-4]
        logger.info(f"[AUTO-SCAN] Normalized URL: {normalized_url}")
        
        # 여러 형태의 Git URL 생성 (비교용)
        possible_urls = [
            decoded_git_url,
            normalized_url,
            f"{normalized_url}.git",
            f"{normalized_url}/",
            f"{normalized_url}/.git",
            decoded_git_url.rstrip('/'),
            decoded_git_url.rstrip('/')[:-4] if decoded_git_url.rstrip('/').endswith('.git') else decoded_git_url.rstrip('/'),
        ]
        # 중복 제거
        possible_urls = list(set(possible_urls))
        logger.info(f"[AUTO-SCAN] Possible URLs to match: {possible_urls}")
        
        # 여러 형태의 Git URL과 비교 (정규화된 형태 포함)
        project = db.query(Project).filter(
            Project.trigger_mode == 'git',
            Project.git_url.in_(possible_urls)
        ).first()
        
        # 위에서 찾지 못한 경우, 정규화된 형태로도 비교 시도
        if not project:
            # DB에 저장된 URL도 정규화하여 비교
            all_git_projects = db.query(Project).filter(Project.trigger_mode == 'git').all()
            for p in all_git_projects:
                p_normalized = p.git_url.rstrip('/') if p.git_url else ''
                if p_normalized.endswith('.git'):
                    p_normalized = p_normalized[:-4]
                if p_normalized == normalized_url:
                    project = p
                    logger.info(f"[AUTO-SCAN] Found project by normalized URL: id={project.id}, name={project.name}")
                    break
        
        if not project:
            logger.warning(f"[AUTO-SCAN] Project not found for git_url: {decoded_git_url}")
            # 디버깅: 모든 git trigger mode 프로젝트 목록 출력
            all_git_projects = db.query(Project).filter(Project.trigger_mode == 'git').all()
            logger.info(f"[AUTO-SCAN] Available git projects: {[(p.id, p.name, p.git_url) for p in all_git_projects]}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project not found for git URL: {decoded_git_url}. Please ensure project is created with correct Git URL."
            )
        
        logger.info(f"[AUTO-SCAN] Found project: id={project.id}, name={project.name}, jenkins_job={project.jenkins_job_name}")
        
        # 프로젝트의 기본 스캔 설정 사용 (없으면 기본값: Full Scan)
        default_scan_mode = project.default_scan_mode or 'custom'  # 'preset' (Quick Scan), 'custom' (Full Scan)
        default_profile_mode = project.default_profile_mode or 'preset'  # 'preset' (기본 설정), 'custom' (고급 설정)
        logger.info(f"[AUTO-SCAN] Using scan_mode={default_scan_mode}, profile_mode={default_profile_mode}")
        
        # 3. Scan 생성 (System User로 생성)
        # 시스템 유저 찾기 (없으면 생성하거나 첫 번째 유저 사용)
        system_user = db.query(User).filter(User.email == "system@l2ve.com").first()
        if not system_user:
            # Fallback: admin 유저
            system_user = db.query(User).filter(User.is_superuser == True).first()
        
        if not system_user:
             # Fallback to project owner if system user fails
             system_user = db.query(User).filter(User.id == project.user_id).first()
             if not system_user:
                 raise HTTPException(status_code=500, detail="System user or Project owner not found for auto-scan")
        
        # Jenkins가 보낸 커밋 해시 등이 payload에 있을 수 있음
        commit_hash = payload.github_commit_hash if hasattr(payload, 'github_commit_hash') else 'Unknown commit'
        
        from app.services.scan_service import ScanService
        from app.schemas.scan import ScanCreate
        
        # 2-2. Provider/Model Fallback Logic
        # Payload(Jenkins/Webhook) -> Project Defaults -> Global Defaults
        final_provider = payload.api_provider or project.default_provider or 'groq'
        final_model = payload.model or project.default_model or 'llama3-70b-8192'
        logger.info(f"[AUTO-SCAN] LLM Config: provider={final_provider}, model={final_model}")
        
        scan_data = ScanCreate(
            name=f"{payload.scan_type or 'ALL'} Scan (Auto)",
            scan_type=payload.scan_type or 'ALL',
            scan_config={
                "github_url": project.git_url,
                "api_provider": final_provider,
                "model": final_model,
                "run_sast": payload.run_sast if payload.run_sast is not None else True,
                "scan_mode": default_scan_mode,
                "profile_mode": default_profile_mode,
            }
        )
        
        logger.info(f"[AUTO-SCAN] Creating scan record for project_id={project.id}, user_id={system_user.id}")

        scan = ScanService.create_scan(
            db=db,
            scan_data=scan_data,
            project_id=project.id,
            user=system_user
        )
        
        # 상태를 running으로 설정 (Jenkins 빌드가 이미 시작되었으므로)
        scan.status = 'running'
        db.commit()
        db.refresh(scan)
        
        logger.info(f"[AUTO-SCAN] Scan created successfully: scan_id={scan.id}, project_id={project.id} (Jenkins build already triggered by webhook)")
        
        return {
            "project_id": project.id,
            "project_name": project.name,
            "id": scan.id,
            "scan_status": scan.status,
            "trigger_mode": project.trigger_mode or 'git',
            "scan_mode": default_scan_mode,
            "profile_mode": default_profile_mode,
            "api_provider": final_provider,
            "model": final_model,
            "message": f"Auto-scan triggered for project '{project.name}' via Git commit event"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[AUTO-SCAN] Unexpected error: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {type(e).__name__}: {str(e)}"
        )

