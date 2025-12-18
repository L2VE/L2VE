"""
Admin API 라우터
- Superuser 전용
- 사용자, 팀, 프로젝트 관리
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.utils.auth import get_current_user
from app.utils.permissions import check_admin
from app.models.user import User
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.project import Project

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ==================== Pydantic Schemas ====================

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str]
    is_active: bool
    is_superuser: bool
    created_at: str
    last_login: Optional[str]
    
    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None


class TeamResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_by: int
    created_at: str
    member_count: int = 0
    
    class Config:
        from_attributes = True


class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None


class TeamMemberResponse(BaseModel):
    id: int
    user_id: int
    username: str
    email: str
    is_manager: bool
    joined_at: str
    
    class Config:
        from_attributes = True


class TeamMemberAdd(BaseModel):
    user_id: int
    is_manager: bool = False


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    user_id: int
    team_id: Optional[int]
    status: str
    created_at: str
    total_scans: int
    total_vulnerabilities: int
    
    class Config:
        from_attributes = True


class ProjectUpdate(BaseModel):
    team_id: Optional[int] = None
    user_id: Optional[int] = None  # 소유자 변경
    status: Optional[str] = None


# ==================== User Management ====================

@router.get("/users", response_model=List[UserResponse])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    모든 사용자 조회 (Admin only)
    """
    check_admin(current_user)
    
    users = db.query(User).all()
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            username=u.username,
            full_name=u.full_name or "",
            is_active=u.is_active,
            is_superuser=u.is_superuser,
            created_at=u.created_at.isoformat() if u.created_at else "",
            last_login=u.last_login.isoformat() if u.last_login else None
        )
        for u in users
    ]


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    사용자 정보 수정 (Admin only)
    - is_active, is_superuser 변경 가능
    """
    check_admin(current_user)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # 자기 자신의 superuser 권한 제거 방지
    if user_id == current_user.id and update_data.is_superuser is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your own superuser privileges"
        )
    
    if update_data.is_active is not None:
        user.is_active = update_data.is_active
    if update_data.is_superuser is not None:
        user.is_superuser = update_data.is_superuser
    
    db.commit()
    db.refresh(user)
    
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        full_name=user.full_name or "",
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        created_at=user.created_at.isoformat() if user.created_at else "",
        last_login=user.last_login.isoformat() if user.last_login else None
    )


# ==================== Team Management ====================

@router.get("/teams", response_model=List[TeamResponse])
def get_all_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    모든 팀 조회 (Admin only)
    """
    check_admin(current_user)
    
    teams = db.query(Team).all()
    result = []
    
    for team in teams:
        member_count = db.query(TeamMember).filter(TeamMember.team_id == team.id).count()
        result.append(TeamResponse(
            id=team.id,
            name=team.name,
            description=team.description or "",
            created_by=team.created_by,
            created_at=team.created_at.isoformat() if team.created_at else "",
            member_count=member_count
        ))
    
    return result


@router.post("/teams", response_model=TeamResponse)
def create_team(
    team_data: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    새 팀 생성 (Admin only)
    """
    check_admin(current_user)
    
    new_team = Team(
        name=team_data.name,
        description=team_data.description,
        created_by=current_user.id
    )
    
    db.add(new_team)
    db.commit()
    db.refresh(new_team)
    
    return TeamResponse(
        id=new_team.id,
        name=new_team.name,
        description=new_team.description or "",
        created_by=new_team.created_by,
        created_at=new_team.created_at.isoformat() if new_team.created_at else "",
        member_count=0
    )


@router.delete("/teams/{team_id}")
def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    팀 삭제 (Admin only)
    """
    check_admin(current_user)
    
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    db.delete(team)
    db.commit()
    
    return {"message": "Team deleted successfully"}


# ==================== Team Member Management ====================

@router.get("/teams/{team_id}/members", response_model=List[TeamMemberResponse])
def get_team_members(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    팀 멤버 조회 (Admin only)
    """
    check_admin(current_user)
    
    members = db.query(TeamMember, User).join(
        User, TeamMember.user_id == User.id
    ).filter(TeamMember.team_id == team_id).all()
    
    return [
        TeamMemberResponse(
            id=tm.id,
            user_id=tm.user_id,
            username=u.username,
            email=u.email,
            is_manager=tm.is_manager,
            joined_at=tm.joined_at.isoformat() if tm.joined_at else ""
        )
        for tm, u in members
    ]


@router.post("/teams/{team_id}/members", response_model=TeamMemberResponse)
def add_team_member(
    team_id: int,
    member_data: TeamMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    팀에 멤버 추가 (Admin only)
    """
    check_admin(current_user)
    
    # 팀 존재 확인
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # 사용자 존재 확인
    user = db.query(User).filter(User.id == member_data.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # 이미 멤버인지 확인
    existing = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == member_data.user_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this team"
        )
    
    # 멤버 추가
    new_member = TeamMember(
        team_id=team_id,
        user_id=member_data.user_id,
        is_manager=member_data.is_manager
    )
    
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    
    return TeamMemberResponse(
        id=new_member.id,
        user_id=new_member.user_id,
        username=user.username,
        email=user.email,
        is_manager=new_member.is_manager,
        joined_at=new_member.joined_at.isoformat() if new_member.joined_at else ""
    )


@router.patch("/teams/{team_id}/members/{user_id}")
def update_team_member(
    team_id: int,
    user_id: int,
    is_manager: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    팀 멤버 권한 수정 (Admin only)
    - is_manager 토글
    """
    check_admin(current_user)
    
    member = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == user_id
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found"
        )
    
    member.is_manager = is_manager
    db.commit()
    
    return {"message": "Team member updated successfully"}


@router.delete("/teams/{team_id}/members/{user_id}")
def remove_team_member(
    team_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    팀에서 멤버 제거 (Admin only)
    """
    check_admin(current_user)
    
    member = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == user_id
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found"
        )
    
    db.delete(member)
    db.commit()
    
    return {"message": "Team member removed successfully"}


# ==================== Project Management ====================

@router.get("/projects", response_model=List[ProjectResponse])
def get_all_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    모든 프로젝트 조회 (Admin only)
    """
    check_admin(current_user)
    
    projects = db.query(Project).all()
    return [
        ProjectResponse(
            id=p.id,
            name=p.name,
            description=p.description or "",
            user_id=p.user_id,
            team_id=p.team_id,
            status=p.status,
            created_at=p.created_at.isoformat() if p.created_at else "",
            total_scans=p.total_scans or 0,
            total_vulnerabilities=p.total_vulnerabilities or 0
        )
        for p in projects
    ]


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    update_data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    프로젝트 수정 (Admin only)
    - team_id, user_id(소유자), status 변경 가능
    """
    check_admin(current_user)
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if update_data.team_id is not None:
        # team_id 유효성 검사
        if update_data.team_id > 0:
            team = db.query(Team).filter(Team.id == update_data.team_id).first()
            if not team:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Team not found"
                )
        project.team_id = update_data.team_id if update_data.team_id > 0 else None
    
    if update_data.user_id is not None:
        # user_id 유효성 검사
        user = db.query(User).filter(User.id == update_data.user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        project.user_id = update_data.user_id
    
    if update_data.status is not None:
        project.status = update_data.status
    
    db.commit()
    db.refresh(project)
    
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description or "",
        user_id=project.user_id,
        team_id=project.team_id,
        status=project.status,
        created_at=project.created_at.isoformat() if project.created_at else "",
        total_scans=project.total_scans or 0,
        total_vulnerabilities=project.total_vulnerabilities or 0
    )


@router.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    프로젝트 삭제 (Admin only)
    """
    check_admin(current_user)
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    db.delete(project)
    db.commit()
    
    return {"message": "Project deleted successfully"}

