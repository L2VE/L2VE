"""
Teams API 라우터
- 일반 사용자: 자신이 속한 팀 조회
- Team Manager: 자신이 관리하는 팀의 멤버 관리
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.utils.auth import get_current_user
from app.utils.permissions import check_team_manager_or_admin, is_team_manager, get_managed_teams
from app.models.user import User
from app.models.team import Team
from app.models.team_member import TeamMember

router = APIRouter(prefix="/api/teams", tags=["teams"])


# ==================== Pydantic Schemas ====================

class TeamResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_manager: bool = False  # 현재 사용자가 이 팀의 관리자인지
    member_count: int = 0
    
    class Config:
        from_attributes = True


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


# ==================== Team Queries ====================

@router.get("/my", response_model=List[TeamResponse])
def get_my_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    내가 속한 팀 목록 조회
    """
    # Superuser는 모든 팀 조회
    if current_user.is_superuser:
        teams = db.query(Team).all()
        return [
            TeamResponse(
                id=team.id,
                name=team.name,
                description=team.description or "",
                is_manager=True,  # Superuser는 모든 팀 관리 가능
                member_count=db.query(TeamMember).filter(TeamMember.team_id == team.id).count()
            )
            for team in teams
        ]
    
    # 일반 사용자: 자신이 속한 팀만
    my_teams = db.query(Team, TeamMember).join(
        TeamMember, Team.id == TeamMember.team_id
    ).filter(TeamMember.user_id == current_user.id).all()
    
    result = []
    for team, membership in my_teams:
        member_count = db.query(TeamMember).filter(TeamMember.team_id == team.id).count()
        result.append(TeamResponse(
            id=team.id,
            name=team.name,
            description=team.description or "",
            is_manager=membership.is_manager,
            member_count=member_count
        ))
    
    return result


@router.get("/{team_id}", response_model=TeamResponse)
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    특정 팀 상세 조회 (해당 팀 멤버만 가능)
    """
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # 권한 확인: Superuser 또는 해당 팀의 멤버
    if not current_user.is_superuser:
        membership = db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == current_user.id
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this team"
            )
        
        is_manager_flag = membership.is_manager
    else:
        is_manager_flag = True
    
    member_count = db.query(TeamMember).filter(TeamMember.team_id == team_id).count()
    
    return TeamResponse(
        id=team.id,
        name=team.name,
        description=team.description or "",
        is_manager=is_manager_flag,
        member_count=member_count
    )


# ==================== Team Member Management (Team Manager) ====================

@router.get("/{team_id}/members", response_model=List[TeamMemberResponse])
def get_team_members(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    팀 멤버 목록 조회 (Team Manager 또는 Admin)
    """
    check_team_manager_or_admin(db, current_user, team_id)
    
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


@router.post("/{team_id}/members", response_model=TeamMemberResponse)
def add_team_member(
    team_id: int,
    member_data: TeamMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    팀에 멤버 추가 (Team Manager 또는 Admin)
    """
    check_team_manager_or_admin(db, current_user, team_id)
    
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


@router.delete("/{team_id}/members/{user_id}")
def remove_team_member(
    team_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    팀에서 멤버 제거 (Team Manager 또는 Admin)
    """
    check_team_manager_or_admin(db, current_user, team_id)
    
    member = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == user_id
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found"
        )
    
    # 마지막 관리자 제거 방지
    manager_count = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.is_manager == True
    ).count()
    
    if member.is_manager and manager_count <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the last manager of the team"
        )
    
    db.delete(member)
    db.commit()
    
    return {"message": "Team member removed successfully"}

