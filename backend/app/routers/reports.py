from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas.report import ReportCreate, ReportUpdate, ReportResponse
from app.services.report_service import ReportService
from app.utils.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/projects/{project_id}/reports", tags=["Reports"])

@router.post("/", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    project_id: int,
    report_data: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create and generate a new report for a project"""
    report = ReportService.create_report(db, report_data, project_id)
    return report

@router.get("/", response_model=List[ReportResponse])
async def get_reports(
    project_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all reports for a project"""
    reports = ReportService.get_project_reports(db, project_id, skip, limit)
    return reports

@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    project_id: int,
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific report"""
    report = ReportService.get_report_by_id(db, report_id, project_id)
    return report

@router.put("/{report_id}", response_model=ReportResponse)
async def update_report(
    project_id: int,
    report_id: int,
    report_data: ReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a report"""
    report = ReportService.update_report(db, report_id, project_id, report_data)
    return report

@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    project_id: int,
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a report"""
    ReportService.delete_report(db, report_id, project_id)
    return None

