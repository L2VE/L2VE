"""
프로젝트 통계 재계산 스크립트
기존 프로젝트의 total_scans, total_vulnerabilities를 업데이트
"""
from app.database import SessionLocal
from app.models.project import Project
from app.models.scan import Scan

def update_all_project_stats():
    db = SessionLocal()
    try:
        projects = db.query(Project).all()
        
        print(f"📊 총 {len(projects)}개 프로젝트 통계 업데이트 중...")
        
        for project in projects:
            # 해당 프로젝트의 모든 스캔 조회
            all_scans = db.query(Scan).filter(Scan.project_id == project.id).all()
            
            # 통계 재계산
            old_total_scans = project.total_scans
            old_total_vulns = project.total_vulnerabilities
            
            project.total_scans = len(all_scans)
            project.total_vulnerabilities = sum((s.vulnerabilities_found or 0) for s in all_scans)
            
            # 마지막 스캔 시간
            if all_scans:
                latest_scan = max(all_scans, key=lambda s: s.created_at if s.created_at else datetime.min)
                project.last_scan_at = latest_scan.created_at
            
            print(f"✅ Project #{project.id} ({project.name}):")
            print(f"   - Total Scans: {old_total_scans} → {project.total_scans}")
            print(f"   - Total Vulnerabilities: {old_total_vulns} → {project.total_vulnerabilities}")
        
        db.commit()
        print(f"\n🎉 통계 업데이트 완료!")
        
    except Exception as e:
        print(f"❌ 에러 발생: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_all_project_stats()

