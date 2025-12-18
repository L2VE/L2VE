from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin
from app.utils.auth import get_password_hash, verify_password
from app.utils.security import (
    sanitize_input,
    sanitize_full_name,
    validate_email,
    validate_username,
    check_sql_injection_patterns
)


class AuthService:
    @staticmethod
    def create_user(db: Session, user_data: UserCreate) -> User:
        """회원가입 - 새로운 사용자 생성 (보안 강화)"""
        # 입력값 검증 및 정제
        email = user_data.email.lower().strip()
        username = sanitize_input(user_data.username)
        full_name = sanitize_full_name(user_data.full_name) if user_data.full_name else None
        
        # 추가 보안 검증
        if not validate_email(email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email format"
            )
        
        if not validate_username(username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid username format"
            )
        
        # SQL Injection 패턴 체크
        for value in [email, username, full_name]:
            if value and check_sql_injection_patterns(value):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid characters detected in input"
                )
        
        # 이메일 중복 체크
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # 사용자명 중복 체크
        existing_username = db.query(User).filter(User.username == username).first()
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        
        # 비밀번호 해싱
        hashed_password = get_password_hash(user_data.password)
        
        # 새 사용자 생성
        new_user = User(
            email=email,
            username=username,
            full_name=full_name,
            hashed_password=hashed_password,
            is_active=True,
            is_superuser=False
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return new_user
    
    @staticmethod
    def authenticate_user(db: Session, user_data: UserLogin) -> User:
        """로그인 - 사용자 인증 (보안 강화)"""
        # 입력값 정제
        email = user_data.email.lower().strip()
        
        # 이메일 형식 검증
        if not validate_email(email):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"  # 보안상 구체적인 에러 노출 안 함
            )
        
        # SQL Injection 패턴 체크
        if check_sql_injection_patterns(email):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        # 사용자 조회
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            # Timing attack 방어를 위해 일정 시간 소요
            get_password_hash("dummy_password_for_timing_attack_prevention")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        if not verify_password(user_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled. Please contact support."
            )
        
        # 마지막 로그인 시간 업데이트
        user.last_login = datetime.utcnow()
        db.commit()
        
        return user
    
    @staticmethod
    def get_user_by_email(db: Session, email: str) -> User:
        """이메일로 사용자 조회"""
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user

