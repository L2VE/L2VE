"""
Rate Limiting 미들웨어
브루트 포스 공격 방어
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Rate limiter 설정
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per hour"],  # 기본: 시간당 200회
    storage_uri="memory://"  # 메모리 기반 저장소 (프로덕션에서는 Redis 권장)
)

