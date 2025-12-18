from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
import re


class UserCreate(BaseModel):
    email: EmailStr = Field(..., max_length=255)
    username: str = Field(..., min_length=3, max_length=50, pattern=r'^[a-zA-Z0-9_-]+$')
    full_name: Optional[str] = Field(None, max_length=255)
    password: str = Field(..., min_length=6, max_length=72)  # bcrypt limit
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        """사용자명 검증"""
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Username can only contain letters, numbers, underscore and hyphen')
        if len(v) < 3 or len(v) > 50:
            raise ValueError('Username must be between 3 and 50 characters')
        return v.strip()
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        """비밀번호 강도 검증"""
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        if len(v) > 72:
            raise ValueError('Password must not exceed 72 characters')
        
        # 최소 2가지 유형의 문자 포함 확인
        has_lower = bool(re.search(r'[a-z]', v))
        has_upper = bool(re.search(r'[A-Z]', v))
        has_digit = bool(re.search(r'\d', v))
        has_special = bool(re.search(r'[!@#$%^&*(),.?":{}|<>_-]', v))
        
        strength_count = sum([has_lower, has_upper, has_digit, has_special])
        
        if strength_count < 2:
            raise ValueError('Password must contain at least 2 of: lowercase, uppercase, numbers, special characters')
        
        return v
    
    @field_validator('full_name')
    @classmethod
    def validate_full_name(cls, v):
        """전체 이름 검증"""
        if v and len(v) > 255:
            raise ValueError('Full name must not exceed 255 characters')
        return v.strip() if v else v


class UserLogin(BaseModel):
    email: EmailStr = Field(..., max_length=255)
    password: str = Field(..., min_length=6, max_length=72)


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str]
    is_active: bool
    is_superuser: bool
    created_at: datetime
    last_login: Optional[datetime]
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class TokenData(BaseModel):
    email: Optional[str] = None

