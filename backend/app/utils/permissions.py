"""
보안 권한 검증 유틸리티 (3단계 권한)
- 직접 객체 참조 취약점(IDOR) 방지
- 수평적 권한 상승 방지
- 모든 프로젝트 접근에 대한 권한 검증

권한 구조:
1. Superuser (Admin): 모든 리소스 관리, 모든 프로젝트 접근
2. Team Manager: 자신이 속한 팀의 멤버만 관리 가능
3. Member: 할당된 프로젝트만 접근 (소유자, 멤버, 팀 소속)
"""
from sqlalchemy.orm import Session
from fastapi import HTTPException, status, Depends
from typing import Callable
from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.team_member import TeamMember


def check_project_access(db: Session, user: User, project_id: int) -> Project:
    """
    프로젝트 접근 권한 검증 (단순화)
    
    Args:
        db: Database session
        user: 현재 사용자
        project_id: 프로젝트 ID
    
    Returns:
        Project: 접근 가능한 프로젝트 객체
    
    Raises:
        HTTPException: 접근 권한이 없는 경우
    
    Security:
        - Superuser: 모든 프로젝트 접근 가능
        - 프로젝트 소유자 (user_id): 전체 권한
        - 프로젝트 멤버 (project_members): 접근 가능
        - 팀 멤버 (project.team_id + team_members): 접근 가능
        - SQL Injection 방지: SQLAlchemy ORM 사용
        - IDOR 방지: user_id와 project_id 검증
    """
    # 1. 프로젝트 존재 확인 (SQL Injection 방지: ORM 사용)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        # 보안: 존재하지 않는 프로젝트도 "권한 없음"으로 처리 (정보 노출 방지)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied"
        )
    
    # 2. Superuser 체크 (관리자는 모든 프로젝트 접근 가능)
    if user.is_superuser:
        return project
    
    # 3. 프로젝트 소유자 체크 (IDOR 방지: user_id 검증)
    if project.user_id == user.id:
        return project
    
    # 4. 프로젝트 멤버 체크
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user.id
    ).first()
    
    if member:
        return project
    
    # 5. 팀 멤버 체크 (프로젝트에 team_id가 할당되어 있고, 사용자가 그 팀의 멤버인 경우)
    if project.team_id:
        team_member = db.query(TeamMember).filter(
            TeamMember.team_id == project.team_id,
            TeamMember.user_id == user.id
        ).first()
        
        if team_member:
            return project
    
    # 보안: 권한 없는 접근 시도 (향후 감사 로그에 추가 가능)
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to access this project"
    )


def can_modify_project(db: Session, user: User, project_id: int) -> bool:
    """
    프로젝트 수정 권한 확인
    
    Returns:
        bool: 수정 권한 여부
    
    Security:
        - Superuser: 모든 프로젝트 수정 가능
        - 프로젝트 소유자만 수정 가능
    """
    if user.is_superuser:
        return True
    
    project = db.query(Project).filter(Project.id == project_id).first()
    return project and project.user_id == user.id


def can_delete_project(db: Session, user: User, project_id: int) -> bool:
    """
    프로젝트 삭제 권한 확인
    
    Returns:
        bool: 삭제 권한 여부
    
    Security:
        - Superuser: 모든 프로젝트 삭제 가능
        - 프로젝트 소유자만 삭제 가능
    """
    if user.is_superuser:
        return True
    
    project = db.query(Project).filter(Project.id == project_id).first()
    return project and project.user_id == user.id


def get_user_projects(db: Session, user: User):
    """
    사용자가 접근 가능한 모든 프로젝트 조회
    
    Returns:
        List[Project]: 접근 가능한 프로젝트 목록
    
    Security:
        - Superuser: 모든 프로젝트
        - 일반 사용자: 소유 프로젝트 + 멤버 프로젝트 + 팀 프로젝트
        - SQL Injection 방지: ORM 사용
    """
    if user.is_superuser:
        # Superuser는 모든 프로젝트 조회
        return db.query(Project).all()
    
    # 사용자가 소유한 프로젝트
    owned_projects = db.query(Project).filter(Project.user_id == user.id).all()
    
    # 사용자가 멤버로 등록된 프로젝트
    member_project_ids = db.query(ProjectMember.project_id).filter(
        ProjectMember.user_id == user.id
    ).all()
    member_project_ids = [pid[0] for pid in member_project_ids]
    
    member_projects = db.query(Project).filter(
        Project.id.in_(member_project_ids)
    ).all() if member_project_ids else []
    
    # 사용자가 소속된 팀에 할당된 프로젝트
    user_team_ids = db.query(TeamMember.team_id).filter(
        TeamMember.user_id == user.id
    ).all()
    user_team_ids = [tid[0] for tid in user_team_ids]
    
    team_projects = db.query(Project).filter(
        Project.team_id.in_(user_team_ids)
    ).all() if user_team_ids else []
    
    # 중복 제거
    all_projects = {p.id: p for p in owned_projects + member_projects + team_projects}
    
    return list(all_projects.values())


def add_project_member(
    db: Session,
    current_user: User,
    project_id: int,
    user_id: int
) -> ProjectMember:
    """
    프로젝트에 멤버 추가
    
    Security:
        - Superuser 또는 프로젝트 소유자만 가능
        - 자기 자신 추가 가능
    """
    # 권한 확인 (superuser 또는 프로젝트 소유자만 가능)
    if not can_modify_project(db, current_user, project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project owner or admin can add members"
        )
    
    # 사용자 존재 확인
    from app.models.user import User as UserModel
    target_user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # 프로젝트 소유자인지 확인 (소유자는 자동으로 접근 가능하므로 추가 불필요)
    project = db.query(Project).filter(Project.id == project_id).first()
    if project and project.user_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project owner is automatically a member"
        )
    
    # 이미 멤버인지 확인
    existing_member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    ).first()
    
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this project"
        )
    
    # 멤버 추가
    new_member = ProjectMember(
        project_id=project_id,
        user_id=user_id,
        added_by=current_user.id
    )
    
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    
    return new_member


def remove_project_member(
    db: Session,
    current_user: User,
    project_id: int,
    user_id: int
) -> bool:
    """
    프로젝트에서 멤버 제거
    
    Security:
        - Superuser 또는 프로젝트 소유자만 가능
        - 프로젝트 소유자는 제거 불가
    """
    # 권한 확인
    if not can_modify_project(db, current_user, project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project owner or admin can remove members"
        )
    
    project = db.query(Project).filter(Project.id == project_id).first()
    
    # 프로젝트 소유자 제거 시도 방지
    if project and project.user_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove project owner"
        )
    
    # 멤버 조회 및 삭제
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this project"
        )
    
    db.delete(member)
    db.commit()
    
    return True


# ==================== Admin & Team Manager 권한 검증 ====================

def check_admin(user: User) -> None:
    """
    Superuser(Admin) 권한 확인
    
    Args:
        user: 현재 사용자
    
    Raises:
        HTTPException: Admin 권한이 없는 경우
    """
    if not user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )


def check_team_manager_or_admin(db: Session, user: User, team_id: int) -> None:
    """
    Team Manager 또는 Admin 권한 확인
    
    Args:
        db: Database session
        user: 현재 사용자
        team_id: 팀 ID
    
    Raises:
        HTTPException: 권한이 없는 경우
    
    Security:
        - Superuser: 모든 팀 관리 가능
        - Team Manager: 자신이 관리자로 등록된 팀만 관리 가능
    """
    # Superuser는 모든 팀 관리 가능
    if user.is_superuser:
        return
    
    # Team Manager 확인
    team_member = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == user.id,
        TeamMember.is_manager == True
    ).first()
    
    if not team_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Team manager or admin privileges required for this team"
        )


def is_team_manager(db: Session, user: User, team_id: int) -> bool:
    """
    사용자가 특정 팀의 관리자인지 확인
    
    Args:
        db: Database session
        user: 현재 사용자
        team_id: 팀 ID
    
    Returns:
        bool: Team Manager 여부
    """
    if user.is_superuser:
        return True
    
    team_member = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == user.id,
        TeamMember.is_manager == True
    ).first()
    
    return team_member is not None


def get_managed_teams(db: Session, user: User):
    """
    사용자가 관리하는 팀 목록 조회
    
    Args:
        db: Database session
        user: 현재 사용자
    
    Returns:
        List[int]: 관리하는 팀 ID 목록
    """
    if user.is_superuser:
        # Superuser는 모든 팀 관리
        from app.models.team import Team
        all_teams = db.query(Team.id).all()
        return [team[0] for team in all_teams]
    
    # Team Manager는 자신이 관리자인 팀만
    managed_team_ids = db.query(TeamMember.team_id).filter(
        TeamMember.user_id == user.id,
        TeamMember.is_manager == True
    ).all()
    
    return [tid[0] for tid in managed_team_ids]

