from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.models.report import Report
from app.models.scan import Scan
from app.schemas.report import ReportCreate, ReportUpdate
from fastapi import HTTPException, status

class ReportService:
    @staticmethod
    def create_report(db: Session, report_data: ReportCreate, project_id: int) -> Report:
        """Create a new report"""
        new_report = Report(
            project_id=project_id,
            title=report_data.title,
            report_type=report_data.report_type,
            date_from=report_data.date_from,
            date_to=report_data.date_to,
            status='generating',
            scan_count=0,
            vulnerabilities_found=0
        )
        
        db.add(new_report)
        db.commit()
        db.refresh(new_report)
        
        # Generate report data (example implementation)
        ReportService._generate_report_data(db, new_report)
        
        return new_report
    
    @staticmethod
    def _generate_report_data(db: Session, report: Report) -> None:
        """Generate report data from scans (example implementation)"""
        # Get all scans in date range
        query = db.query(Scan).filter(Scan.project_id == report.project_id)
        
        if report.date_from:
            query = query.filter(Scan.created_at >= report.date_from)
        if report.date_to:
            query = query.filter(Scan.created_at <= report.date_to)
        
        scans = query.all()
        
        # Calculate statistics
        report.scan_count = len(scans)
        report.vulnerabilities_found = sum(scan.vulnerabilities_found for scan in scans)
        
        # Generate summary
        total_critical = sum(scan.critical for scan in scans)
        total_high = sum(scan.high for scan in scans)
        total_medium = sum(scan.medium for scan in scans)
        total_low = sum(scan.low for scan in scans)
        
        report.summary = f"Report generated for {report.scan_count} scans. " \
                        f"Found {report.vulnerabilities_found} vulnerabilities: " \
                        f"{total_critical} Critical, {total_high} High, " \
                        f"{total_medium} Medium, {total_low} Low."
        
        # Generate detailed report data
        report.report_data = {
            "total_scans": report.scan_count,
            "total_vulnerabilities": report.vulnerabilities_found,
            "severity_breakdown": {
                "critical": total_critical,
                "high": total_high,
                "medium": total_medium,
                "low": total_low
            },
            "scans": [
                {
                    "id": scan.id,
                    "name": scan.name,
                    "status": scan.status,
                    "vulnerabilities": scan.vulnerabilities_found
                } for scan in scans
            ]
        }
        
        report.status = 'completed'
        report.generated_at = datetime.now()
        
        db.commit()
        db.refresh(report)
    
    @staticmethod
    def get_project_reports(db: Session, project_id: int, skip: int = 0, limit: int = 100) -> List[Report]:
        """Get all reports for a project"""
        return db.query(Report)\
            .filter(Report.project_id == project_id)\
            .order_by(Report.created_at.desc())\
            .offset(skip)\
            .limit(limit)\
            .all()
    
    @staticmethod
    def get_report_by_id(db: Session, report_id: int, project_id: int) -> Optional[Report]:
        """Get a specific report by ID"""
        report = db.query(Report).filter(
            Report.id == report_id,
            Report.project_id == project_id
        ).first()
        
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found"
            )
        
        return report
    
    @staticmethod
    def update_report(db: Session, report_id: int, project_id: int, report_data: ReportUpdate) -> Report:
        """Update a report"""
        report = ReportService.get_report_by_id(db, report_id, project_id)
        
        # Update only provided fields
        update_data = report_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(report, field, value)
        
        db.commit()
        db.refresh(report)
        
        return report
    
    @staticmethod
    def delete_report(db: Session, report_id: int, project_id: int) -> None:
        """Delete a report"""
        report = ReportService.get_report_by_id(db, report_id, project_id)
        
        db.delete(report)
        db.commit()

