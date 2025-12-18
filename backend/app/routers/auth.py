from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import timedelta
from app.database import get_db
from app.schemas.user import UserCreate, UserLogin, Token, UserResponse
from app.services.auth_service import AuthService
from app.utils.auth import create_access_token, get_current_active_user
from app.models.user import User
from app.config import get_settings
from app.middleware.rate_limit import limiter

settings = get_settings()
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")  # 시간당 5회로 제한 (스팸 방지)
async def signup(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    """
    회원가입 API (보안 강화)
    - 이메일, 사용자명, 비밀번호로 새 계정 생성
    - 성공 시 JWT 토큰과 사용자 정보 반환
    - Rate Limiting: 시간당 5회
    - 입력값 검증 및 XSS/SQLi 방어
    """
    try:
        # 새 사용자 생성
        new_user = AuthService.create_user(db, user_data)
        
        # JWT 토큰 생성
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": new_user.email},
            expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": new_user
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during signup: {str(e)}"
        )


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")  # 분당 10회로 제한 (브루트포스 방지)
async def login(request: Request, user_data: UserLogin, db: Session = Depends(get_db)):
    """
    로그인 API (보안 강화)
    - 이메일과 비밀번호로 인증
    - 성공 시 JWT 토큰과 사용자 정보 반환
    - Rate Limiting: 분당 10회
    - Timing attack 방어
    """
    try:
        # 사용자 인증
        user = AuthService.authenticate_user(db, user_data)
        
        # JWT 토큰 생성
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email},
            expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during login: {str(e)}"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """
    현재 로그인한 사용자 정보 조회
    - JWT 토큰으로 인증
    """
    return current_user


@router.post("/logout")
async def logout():
    """
    로그아웃 API
    - 클라이언트 측에서 토큰 삭제 처리
    """
    return {"message": "Successfully logged out"}

