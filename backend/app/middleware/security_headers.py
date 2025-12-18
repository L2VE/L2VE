"""
보안 헤더 미들웨어
XSS, Clickjacking 등 다양한 공격 방어
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Swagger UI (/docs, /redoc)는 CSP 적용 제외
        if request.url.path in ["/docs", "/redoc", "/openapi.json"]:
            return response
        
        # XSS 방어
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Clickjacking 방어
        response.headers["X-Frame-Options"] = "DENY"
        
        # HTTPS 강제 (프로덕션)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Content Security Policy (개발 환경용 - Swagger UI 허용)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https:; "
            "font-src 'self' data: https://cdn.jsdelivr.net; "
            "connect-src 'self' http://localhost:5173;"
        )
        
        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions Policy
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        return response


def add_security_headers(app):
    """애플리케이션에 보안 헤더 미들웨어 추가"""
    app.add_middleware(SecurityHeadersMiddleware)

