from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.routers import auth_router
from app.routers.projects import router as projects_router
from app.routers.scans import router as scans_router
from app.routers.reports import router as reports_router
from app.routers.admin import router as admin_router
from app.routers.teams import router as teams_router
from app.routers.jenkins import router as jenkins_router
from app.routers.jenkins_credentials import router as jenkins_credentials_router
from app.routers.vulns import router as vulns_router
from app.database import engine, Base
from app.middleware.rate_limit import limiter
from app.middleware.security_headers import add_security_headers

# 모든 모델 import (SQLAlchemy가 테이블을 인식하도록)
from app.models import user, project, scan, vulnerability, report, team, seed_db, analysis_result

# 데이터베이스 테이블 생성
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="L2VE API",
    description="LLM-based Vulnerability Analysis Platform - Secure Edition",
    version="1.0.0"
)

# Rate Limiter 설정
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 보안 헤더 미들웨어 추가
add_security_headers(app)

# CORS 설정 (React와 통신용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 origin 허용 (테스트용)
    # allow_origins=[
    #     "http://localhost:5173",
    #     "http://localhost",
    #     "http://localhost:3000",
    #     "http://113.198.66.77",
    #     "http://113.198.66.77:18196",
    #     "http://113.198.66.77:13196",
    #     "http://113.198.66.77:3000",
    # ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(scans_router)
app.include_router(reports_router)
app.include_router(admin_router)
app.include_router(teams_router)
app.include_router(jenkins_router)
app.include_router(jenkins_credentials_router)
app.include_router(vulns_router)  # Discovery/Analysis Agent용

@app.get("/")
async def root():
    return {
        "message": "L2VE API Server",
        "version": "1.0.0",
        "security": "enabled"
    }

@app.get("/health")
@limiter.limit("60/minute")
async def health_check(request: Request):
    return {"status": "healthy", "secure": True}
