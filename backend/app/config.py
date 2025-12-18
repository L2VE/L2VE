from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from typing import Optional, Tuple


class Settings(BaseSettings):
    # 모든 값은 .env에서 로드 (기본값 없음 - 명시적으로 설정 필수)
    # Database
    DB_ENGINE: str = "postgresql"
    DB_HOST: Optional[str] = None
    DB_PORT: Optional[int] = None
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_NAME: Optional[str] = None

    # Legacy MySQL 환경변수 (호환성 유지용)
    MYSQL_HOST: Optional[str] = None
    MYSQL_PORT: Optional[int] = None
    MYSQL_USER: Optional[str] = None
    MYSQL_PASSWORD: Optional[str] = None
    MYSQL_DATABASE: Optional[str] = None
    
    # PostgreSQL 환경변수 (seed_db용)
    POSTGRES_HOST: Optional[str] = None
    POSTGRES_PORT: Optional[int] = None
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: Optional[str] = None
    
    # JWT Settings
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # API Settings
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 3000
    DEBUG: bool = False
    
    # Jenkins
    JENKINS_URL: str
    JENKINS_USER: str
    JENKINS_API_TOKEN: str
    JENKINS_JOB_NAME: str
    JENKINS_CALLBACK_SECRET: str
    BACKEND_SERVICE_API_KEY: str
    JENKINS_GIT_CREDENTIALS_ID: Optional[str] = "github-token2"  # Jenkins Git credentials ID (기본값: github-token)
    GITHUB_TOKEN: Optional[str] = None  # GitHub Personal Access Token (webhook 자동 등록용)
    JENKINSFILE_PATH: Optional[str] = None  # Jenkinsfile 절대 경로 (선택사항, 미지정 시 자동 탐색)
    JENKINSFILE_GIT_URL: Optional[str] = None  # Jenkinsfile Git 저장소 URL (SCM 모드 사용 시, Script Security 회피)
    JENKINSFILE_LOCAL_PATH: Optional[str] = None  # Jenkinsfile 로컬 파일 시스템 경로 (Jenkins 서버 기준, 예: /home/ubuntu/jg/L2VE)
    JENKINSFILE_BRANCH: Optional[str] = "main"  # Jenkinsfile Git 브랜치 (기본값: main)
    PROJECT_ROOT: Optional[str] = None  # 프로젝트 루트 디렉토리 경로 (선택사항)
    
    def _resolve_db_settings(self) -> Tuple[str, int, str, str, str, str]:
        """데이터베이스 접속 정보를 반환한다. (엔진, 호스트, 포트, 사용자, 비밀번호, DB명)"""
        if self.DB_HOST and self.DB_PORT and self.DB_USER and self.DB_PASSWORD and self.DB_NAME:
            engine = self.DB_ENGINE.lower()
            return engine, self.DB_HOST, self.DB_PORT, self.DB_USER, self.DB_PASSWORD, self.DB_NAME

        # 기존 MYSQL_* 환경 변수를 사용하는 경우 (백워드 호환)
        if self.MYSQL_HOST and self.MYSQL_PORT and self.MYSQL_USER and self.MYSQL_PASSWORD and self.MYSQL_DATABASE:
            return "mysql", self.MYSQL_HOST, self.MYSQL_PORT, self.MYSQL_USER, self.MYSQL_PASSWORD, self.MYSQL_DATABASE

        raise ValueError(
            "Database configuration is missing. Please set DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME environment variables."
        )

    @property
    def DATABASE_URL(self) -> str:
        engine, host, port, user, password, name = self._resolve_db_settings()

        if engine in {"postgres", "postgresql", "pg"}:
            driver = "postgresql+psycopg2"
        elif engine == "mysql":
            driver = "mysql+pymysql"
        else:
            raise ValueError(f"Unsupported database engine: {engine}")

        return f"{driver}://{user}:{password}@{host}:{port}/{name}"
    
    @property
    def POSTGRES_DATABASE_URL(self) -> Optional[str]:
        """PostgreSQL 연결 URL (seed_db용)"""
        if self.POSTGRES_HOST and self.POSTGRES_PORT and self.POSTGRES_USER and self.POSTGRES_PASSWORD and self.POSTGRES_DB:
            return f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        # Fallback: DB_* 환경변수가 PostgreSQL이면 사용
        engine, host, port, user, password, name = self._resolve_db_settings()
        if engine in {"postgres", "postgresql", "pg"}:
            return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{name}"
        return None
    
    class Config:
        # .env 파일 경로 (backend/app에서 루트까지)
        # Docker: 환경변수로 전달받음
        # 로컬: .env.local 또는 .env 파일 사용
        env_file_encoding = 'utf-8'
        case_sensitive = True
        extra = "ignore"
        
        @classmethod
        def settings_customise_sources(
            cls,
            settings_cls,
            init_settings,
            env_settings,
            dotenv_settings,
            file_secret_settings,
        ):
            # 환경별 .env 파일 우선순위 (런타임에 체크)
            from pathlib import Path
            from pydantic_settings import DotEnvSettingsSource
            
            # backend/app/config.py 위치 기준 루트 찾기
            base_path = Path(__file__).parent.parent.parent  # L2VE/
            
            candidates = [
                base_path / ".env.production",
                base_path / ".env.local", 
                base_path / ".env",
            ]
            
            env_file = next((f for f in candidates if f.exists()), None)
            
            if env_file:
                return (
                    init_settings,
                    env_settings,
                    DotEnvSettingsSource(
                        settings_cls,
                        env_file=env_file,
                        env_file_encoding='utf-8',
                        case_sensitive=True
                    ),
                    file_secret_settings,
                )
            
            return (init_settings, env_settings, dotenv_settings, file_secret_settings)


@lru_cache()
def get_settings():
    return Settings()

