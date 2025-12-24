
import os
import sys

# Add backend directory to path so imports work
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
sys.path.append(backend_dir)

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.project import Project
from app.services.project_service import ProjectService
from app.config import get_settings

def refresh_jenkins_jobs():
    """
    모든 프로젝트의 Jenkins Job을 재생성(Re-provision)합니다.
    - Jenkins Job Config XML 업데이트 (Git URL normalization 등 적용)
    - DB의 Webhook URL 필드 업데이트 (외부 URL 로직 적용)
    """
    db = SessionLocal()
    try:
        print("==> Starting Jenkins Job Refresh...")
        projects = db.query(Project).all()
        print(f"==> Found {len(projects)} projects.")

        settings = get_settings()
        # 개발 환경이나 Docker Compose 환경에서 로컬호스트를 외부 IP처럼 사용하기 위한 기본값
        request_host = "localhost" 
        
        # 만약 실제 외부 IP가 환경변수로 있다면 사용 (여기선 간단히 localhost/config 값 사용)
        
        for project in projects:
            print(f"\n[Project: {project.name}]")
            try:
                # Trigger mode에 상관없이 Job이 있으면 업데이트 시도
                # 특히 Git 모드인 경우 URL 수정 등이 중요함
                
                # 강제로 re-provision 수행
                print(f"  - Re-provisioning Jenkins job...")
                # request_host를 전달하여 webhook url 계산 유도
                ProjectService._provision_jenkins_job(db, project, allow_existing_job=True, request_host=request_host)
                print(f"  - SUCCESS. Updated Jenkins job and DB record.")
                print(f"  - New Webhook URL: {project.webhook_url}")
                
            except Exception as e:
                print(f"  - FAILED: {str(e)}")
        
        print("\n==> Refresh completed successfully.")
        
    except Exception as e:
        print(f"\n==> Fatal Error: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    # Add backend directory to path so imports work
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(current_dir, '..')
    sys.path.append(backend_dir)
    
    refresh_jenkins_jobs()
