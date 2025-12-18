from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.utils.permissions import check_project_access, get_user_projects, can_delete_project
from fastapi import HTTPException, status
from app.services.jenkins_job_service import JenkinsJobService

class ProjectService:
    @staticmethod
    def create_project(db: Session, project_data: ProjectCreate, user_id: int) -> Project:
        """
        Create a new project
        
        Security:
            - Input validation via Pydantic schema
            - SQL Injection 방지: ORM 사용
            - XSS 방지: 데이터 검증 및 이스케이핑
        """
        # Check if project name already exists for this user
        existing = db.query(Project).filter(
            Project.user_id == user_id,
            Project.name == project_data.name
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project with this name already exists"
            )
        
        # Validate trigger-specific fields
        trigger_mode = project_data.trigger_mode.value if hasattr(project_data.trigger_mode, "value") else project_data.trigger_mode
        if trigger_mode == "git":
            if not project_data.git_url or not project_data.git_branch:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="git_url and git_branch are required for git trigger mode"
                )

        # Create new project
        new_project = Project(
            name=project_data.name,
            description=project_data.description,
            user_id=user_id,
            team_id=project_data.team_id,
            status='active',
            total_scans=0,
            total_vulnerabilities=0,
            trigger_mode=trigger_mode or 'web',
            git_url=project_data.git_url,
            git_branch=project_data.git_branch,
            webhook_secret=project_data.webhook_secret,
            default_scan_mode=project_data.default_scan_mode or 'custom',  # 기본값: Full Scan
            default_profile_mode=project_data.default_profile_mode or 'preset',  # 기본값: 기본 설정
            # Jenkins job info will be populated after job provisioning
            jenkins_job_name=None,
            jenkins_job_url=None,
            webhook_url=None
        )
        
        db.add(new_project)
        db.commit()
        db.refresh(new_project)

        # 모든 프로젝트에 대해 Jenkins job 생성 (web 또는 git trigger mode 모두)
        try:
            print(f"[DEBUG] Provisioning Jenkins job for project: name={new_project.name}, trigger_mode={new_project.trigger_mode}, git_url={new_project.git_url}")
            ProjectService._provision_jenkins_job(db, new_project, allow_existing_job=False)
        except Exception as exc:
            db.delete(new_project)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Project created but failed to provision Jenkins job: {exc}"
            )
        
        return new_project
    
    @staticmethod
    def get_user_projects_list(db: Session, user: User, skip: int = 0, limit: int = 100) -> List[Project]:
        """
        Get all projects accessible by the user
        
        Security:
            - Superuser: 모든 프로젝트
            - 일반 사용자: 소유 프로젝트 + 멤버 프로젝트
            - IDOR 방지: 권한 검증
        """
        all_projects = get_user_projects(db, user)
        
        # Sort by created_at descending
        all_projects.sort(key=lambda p: p.created_at, reverse=True)
        
        # Apply pagination
        return all_projects[skip:skip + limit]
    
    @staticmethod
    def get_project_by_id(db: Session, project_id: int, user: User) -> Optional[Project]:
        """
        Get a specific project by ID with permission check
        
        Security:
            - IDOR 방지: 권한 검증
            - 접근 권한이 없는 프로젝트는 404 반환
        """
        project = check_project_access(db, user, project_id)
        return project
    
    @staticmethod
    def update_project(db: Session, project_id: int, user: User, project_data: ProjectUpdate) -> Project:
        """
        Update a project
        
        Security:
            - Superuser 또는 프로젝트 소유자만 수정 가능
            - Input validation via Pydantic
        """
        # Check permission (superuser or owner only)
        from app.utils.permissions import can_modify_project
        if not can_modify_project(db, user, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only project owner or admin can modify the project"
            )
        
        project = check_project_access(db, user, project_id)
        
        original_trigger_mode = project.trigger_mode
        original_git_url = project.git_url
        original_git_branch = project.git_branch

        # Update only provided fields
        update_data = project_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(value, "value"):
                value = value.value
            setattr(project, field, value)
        
        db.commit()
        db.refresh(project)

        # Handle Jenkins job provisioning logic after commit
        if original_trigger_mode != project.trigger_mode:
            # Trigger mode 변경 시 job 재생성
            ProjectService._provision_jenkins_job(db, project, allow_existing_job=True)
        elif project.trigger_mode == 'git' and (
            ('git_url' in update_data and update_data.get('git_url') != original_git_url) or
            ('git_branch' in update_data and update_data.get('git_branch') != original_git_branch)
        ):
            # Git URL 또는 branch 변경 시 job 업데이트
            ProjectService._provision_jenkins_job(db, project, allow_existing_job=True)
        
        return project
    
    @staticmethod
    def delete_project(db: Session, project_id: int, user: User) -> None:
        """
        Delete a project
        
        Security:
            - Owner만 삭제 가능
            - Superuser는 모든 프로젝트 삭제 가능
        """
        if not can_delete_project(db, user, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only project owner can delete the project"
            )
        
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        # 모든 trigger mode에서 Jenkins job 삭제
        ProjectService._cleanup_jenkins_job(db, project)
        
        db.delete(project)
        db.commit()
    
    @staticmethod
    def get_project_stats(db: Session, user: User) -> dict:
        """
        Get statistics for user's accessible projects
        
        Security:
            - 권한이 있는 프로젝트만 통계에 포함
        """
        projects = get_user_projects(db, user)
        
        total_projects = len(projects)
        active_projects = sum(1 for p in projects if p.status == 'active')
        total_scans = sum((p.total_scans or 0) for p in projects)
        total_vulnerabilities = sum((p.total_vulnerabilities or 0) for p in projects)
        
        return {
            "total_projects": total_projects,
            "active_projects": active_projects,
            "total_scans": total_scans,
            "total_vulnerabilities": total_vulnerabilities
        }

    @staticmethod
    def _provision_jenkins_job(db: Session, project: Project, allow_existing_job: bool = True) -> None:
        """
        Provision Jenkins job for a project (both web and git trigger modes).
        """
        service = JenkinsJobService()
        
        # Git trigger mode인 경우 git_url과 git_branch 필수
        if project.trigger_mode == 'git':
            if not project.git_url or not project.git_branch:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="git_url and git_branch are required for git trigger mode"
                )
        
        try:
            print(f"[DEBUG] Calling provision_pipeline for project: {project.name}")
            job_info = service.provision_pipeline(
                project_name=project.name,
                trigger_mode=project.trigger_mode,
                job_name=project.jenkins_job_name if allow_existing_job else None,
                git_url=project.git_url,
                git_branch=project.git_branch,
                webhook_secret=project.webhook_secret
            )
            print(f"[DEBUG] Jenkins job provisioned: {job_info}")
        except Exception as exc:
            print(f"[ERROR] Failed to provision Jenkins job: {exc}")
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc)
            )

        project.jenkins_job_name = job_info["job_name"]
        project.jenkins_job_url = job_info["job_url"]
        project.webhook_url = job_info.get("webhook_url")  # git mode일 때만 설정됨
        print(f"[DEBUG] Updated project with Jenkins info: job_name={project.jenkins_job_name}, job_url={project.jenkins_job_url}")
        db.commit()
        db.refresh(project)
        print(f"[DEBUG] Project committed to DB: id={project.id}, jenkins_job_name={project.jenkins_job_name}")

    @staticmethod
    def _cleanup_jenkins_job(db: Session, project: Project) -> None:
        """
        Clean up Jenkins job for a project (both web and git trigger modes).
        """
        if not project.jenkins_job_name:
            return
        service = JenkinsJobService()
        try:
            service.delete_job(project.jenkins_job_name)
        except Exception:
            # Best-effort cleanup; log if logging configured
            pass
        project.jenkins_job_name = None
        project.jenkins_job_url = None
        project.webhook_url = None
        db.commit()
        db.refresh(project)

    @staticmethod
    def _provision_git_job(db: Session, project: Project, allow_existing_job: bool = True) -> None:
        """Backward compatibility wrapper."""
        return ProjectService._provision_jenkins_job(db, project, allow_existing_job)

    @staticmethod
    def _cleanup_git_job(db: Session, project: Project) -> None:
        """Backward compatibility wrapper."""
        return ProjectService._cleanup_jenkins_job(db, project)

