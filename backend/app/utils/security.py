"""
보안 유틸리티 함수들
- XSS 방어
- 입력값 검증
- SQL Injection 방어
"""
import re
import bleach
from typing import Optional


def sanitize_input(text: str) -> str:
    """
    XSS 공격 방어를 위한 입력값 정제
    HTML 태그 제거 및 특수문자 이스케이프
    """
    if not text:
        return text
    
    # HTML 태그 완전 제거
    cleaned = bleach.clean(text, tags=[], strip=True)
    
    # 추가 특수문자 처리
    cleaned = cleaned.strip()
    
    return cleaned


def validate_email(email: str) -> bool:
    """
    이메일 형식 검증 (추가 보안)
    """
    if not email or len(email) > 255:
        return False
    
    # RFC 5322 기반 이메일 정규식 (간소화)
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    return bool(re.match(pattern, email))


def validate_username(username: str) -> bool:
    """
    사용자명 검증
    - 3-50자
    - 영문, 숫자, 언더스코어, 하이픈만 허용
    """
    if not username or len(username) < 3 or len(username) > 50:
        return False
    
    pattern = r'^[a-zA-Z0-9_-]+$'
    return bool(re.match(pattern, username))


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    비밀번호 강도 검증
    
    Returns:
        tuple: (유효여부, 에러 메시지)
    """
    if not password:
        return False, "Password is required"
    
    if len(password) < 6:
        return False, "Password must be at least 6 characters long"
    
    if len(password) > 72:
        return False, "Password must not exceed 72 characters"
    
    # 권장 사항 체크 (경고만, 차단하지 않음)
    has_lower = bool(re.search(r'[a-z]', password))
    has_upper = bool(re.search(r'[A-Z]', password))
    has_digit = bool(re.search(r'\d', password))
    has_special = bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password))
    
    strength_count = sum([has_lower, has_upper, has_digit, has_special])
    
    if strength_count < 2:
        return False, "Password must contain at least 2 of: lowercase, uppercase, numbers, special characters"
    
    return True, "Password is valid"


def sanitize_full_name(name: Optional[str]) -> Optional[str]:
    """
    전체 이름 정제
    - XSS 방어
    - 길이 제한
    """
    if not name:
        return name
    
    # HTML 태그 제거
    cleaned = bleach.clean(name, tags=[], strip=True)
    
    # 길이 제한
    if len(cleaned) > 255:
        cleaned = cleaned[:255]
    
    return cleaned.strip() if cleaned else None


def check_sql_injection_patterns(text: str) -> bool:
    """
    SQL Injection 패턴 감지
    
    Returns:
        bool: 의심스러운 패턴이 있으면 True
    """
    if not text:
        return False
    
    # 위험한 SQL 키워드 패턴
    dangerous_patterns = [
        r'(\bUNION\b.*\bSELECT\b)',
        r'(\bDROP\b.*\bTABLE\b)',
        r'(\bINSERT\b.*\bINTO\b)',
        r'(\bUPDATE\b.*\bSET\b)',
        r'(\bDELETE\b.*\bFROM\b)',
        r'(--)',
        r'(\/\*.*\*\/)',
        r'(\bEXEC\b|\bEXECUTE\b)',
        r'(\bOR\b.*=.*)',
        r"('.*(OR|AND).*=.*')",
    ]
    
    text_upper = text.upper()
    
    for pattern in dangerous_patterns:
        if re.search(pattern, text_upper, re.IGNORECASE):
            return True
    
    return False


def validate_and_sanitize_input(
    value: str,
    field_name: str,
    max_length: int = 255,
    allow_special_chars: bool = True
) -> str:
    """
    통합 입력값 검증 및 정제
    
    Args:
        value: 검증할 값
        field_name: 필드 이름 (에러 메시지용)
        max_length: 최대 길이
        allow_special_chars: 특수문자 허용 여부
        
    Returns:
        str: 정제된 값
        
    Raises:
        ValueError: 검증 실패 시
    """
    if not value:
        raise ValueError(f"{field_name} is required")
    
    # SQL Injection 패턴 체크
    if check_sql_injection_patterns(value):
        raise ValueError(f"Invalid characters detected in {field_name}")
    
    # XSS 방어
    sanitized = sanitize_input(value)
    
    # 길이 검증
    if len(sanitized) > max_length:
        raise ValueError(f"{field_name} must not exceed {max_length} characters")
    
    # 특수문자 검증 (옵션)
    if not allow_special_chars:
        if not re.match(r'^[a-zA-Z0-9_-]+$', sanitized):
            raise ValueError(f"{field_name} can only contain letters, numbers, underscore and hyphen")
    
    return sanitized

