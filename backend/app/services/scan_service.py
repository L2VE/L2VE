from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Optional
from datetime import datetime
from app.models.scan import Scan
from app.models.user import User
from app.models.project import Project
from app.models.vulnerability import Vulnerability
from app.models.analysis_result import AnalysisResult
from app.schemas.scan import ScanCreate, ScanUpdate, TriggerScanRequest, IngestScanResults, ScanProgressUpdate
from app.utils.jenkins_client import JenkinsClient
from app.utils.permissions import check_project_access
from fastapi import HTTPException, status
import json
import logging
import re

logger = logging.getLogger(__name__)

class ScanService:
    @staticmethod
    def create_scan(db: Session, scan_data: ScanCreate, project_id: int, user: User) -> Scan:
        """
        Create a new scan
        
        Security:
            - Requires project access (owner, member, or team member)
            - Input validation via Pydantic
        """
        # Check project access
        check_project_access(db, user, project_id)
        
        new_scan = Scan(
            project_id=project_id,
            name=scan_data.name,
            scan_type=scan_data.scan_type,
            scan_config=scan_data.scan_config,
            status='pending',
            vulnerabilities_found=0,
            critical=0,
            high=0,
            medium=0,
            low=0
        )
        
        db.add(new_scan)
        db.commit()
        db.refresh(new_scan)
        
        return new_scan
    
    @staticmethod
    def get_project_scans(db: Session, project_id: int, user: User, skip: int = 0, limit: int = 100) -> List[Scan]:
        """
        Get all scans for a project
        
        Security:
            - Requires project access
        """
        # Check project access
        check_project_access(db, user, project_id)
        
        return db.query(Scan)\
            .filter(Scan.project_id == project_id)\
            .order_by(Scan.created_at.desc())\
            .offset(skip)\
            .limit(limit)\
            .all()
    
    @staticmethod
    def get_scan_by_id(db: Session, scan_id: int, project_id: int, user: User) -> Optional[Scan]:
        """
        Get a specific scan by ID
        
        Security:
            - Requires project access
            - IDOR prevention
        """
        # Check project access first
        check_project_access(db, user, project_id)
        
        scan = db.query(Scan).filter(
            Scan.id == scan_id,
            Scan.project_id == project_id
        ).first()
        
        if not scan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Scan not found"
            )
        
        return scan
    
    @staticmethod
    def update_scan(db: Session, scan_id: int, project_id: int, user: User, scan_data: ScanUpdate) -> Scan:
        """
        Update a scan
        
        Security:
            - Requires project access
        """
        # Check project access
        check_project_access(db, user, project_id)
        
        scan = ScanService.get_scan_by_id(db, scan_id, project_id, user)
        
        # Update only provided fields
        update_data = scan_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(scan, field, value)
        
        # Update timestamps based on status
        if scan_data.status == 'running' and not scan.started_at:
            scan.started_at = datetime.now()
        elif scan_data.status == 'completed' and not scan.completed_at:
            scan.completed_at = datetime.now()
        
        db.commit()
        db.refresh(scan)
        
        return scan
    
    @staticmethod
    def delete_scan(db: Session, scan_id: int, project_id: int, user: User) -> None:
        """
        Delete a scan
        
        Security:
            - Requires project access
        """
        # Check project access
        check_project_access(db, user, project_id)
        
        scan = ScanService.get_scan_by_id(db, scan_id, project_id, user)
        
        db.delete(scan)
        db.commit()
    
    @staticmethod
    def start_scan(db: Session, scan_id: int, project_id: int, user: User) -> Scan:
        """
        Start a scan
        
        Security:
            - Requires project access
        """
        # Check project access
        check_project_access(db, user, project_id)
        
        scan = ScanService.get_scan_by_id(db, scan_id, project_id, user)
        
        if scan.status != 'pending':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Scan has already been started"
            )
        
        scan.status = 'running'
        scan.started_at = datetime.now()
        
        db.commit()
        db.refresh(scan)
        
        # TODO: Implement actual scanning logic here
        # This would typically be done asynchronously with Celery or similar
        
        return scan

    @staticmethod
    def trigger_jenkins_scan(
        db: Session,
        project_id: int,
        user: User,
        payload: TriggerScanRequest
    ) -> Scan:
        # 권한 확인
        check_project_access(db, user, project_id)

        # Scan 레코드 생성 (pending)
        new_scan = Scan(
            project_id=project_id,
            name=f"{payload.scan_type} Scan",
            scan_type=payload.scan_type,
            status='pending',
            scan_config={
                "github_url": payload.github_url,
                "api_provider": payload.api_provider,
                "model": payload.model,
                "run_sast": payload.run_sast,
                "notify_emails": payload.notify_emails or [],
            }
        )
        db.add(new_scan)
        db.commit()
        db.refresh(new_scan)

        # 프로젝트 정보 가져오기 (Jenkins job name 확인)
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        
        if not project.jenkins_job_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project does not have a Jenkins job configured. Please ensure the project has a Jenkins job."
            )
        
        # Jenkins 트리거
        client = JenkinsClient()
        # scan_mode: Quick Scan ('preset') vs Full Scan ('custom')
        # profile_mode: 각 스캔 타입 내에서 preset (기본) vs custom (고급)
        scan_mode = payload.scan_mode or 'custom'  # 기본값은 Full Scan
        
        # 파일 업로드 vs Git clone 구분
        # source_type이 없으면 자동 감지: uploaded_file_path가 있으면 'upload', github_url이 있으면 'git'
        if payload.source_type:
            source_type = payload.source_type
        elif payload.uploaded_file_path:
            source_type = 'upload'
        elif payload.github_url:
            source_type = 'git'
        else:
            raise ValueError("Either source_type must be specified, or uploaded_file_path (for upload) or github_url (for git) must be provided")
        
        # 웹 기반 프로젝트에서 github_url이 없으면 프로젝트의 git_url 사용
        # (Auto-Scan Setup 스테이지가 실행되지 않도록 하기 위함)
        github_url = payload.github_url
        if not github_url and source_type == 'git' and project.git_url:
            github_url = project.git_url
            logger.info(f"[JENKINS TRIGGER] Using project's git_url: {github_url}")
        
        params = {
            'SOURCE_TYPE': source_type,  # 'git' or 'upload'
            'GITHUB_URL': github_url or '',  # Git URL (source_type='git'일 때 사용, 프로젝트의 git_url 자동 사용)
            'UPLOADED_FILE_PATH': payload.uploaded_file_path or '',  # 업로드된 파일 경로 (source_type='upload'일 때 사용)
            'PROJECT_NAME': payload.project_name or '',  # 프로젝트 이름 (파일 업로드 시 사용)
            'SCAN_TYPE': payload.scan_type,
            'API_PROVIDER': payload.api_provider,
            'MODEL': payload.model,
            'RUN_SAST': 'true' if payload.run_sast else 'false',
            'SCAN_MODE': scan_mode,  # Quick Scan vs Full Scan 구분
            'PROFILE_MODE': payload.profile_mode or 'preset',  # 각 스캔 타입 내에서 preset/custom 구분
            'PROJECT_ID': str(project_id),
            'SCAN_ID': str(new_scan.id),
            'TRIGGER_MODE': project.trigger_mode or 'web',  # 'web' (웹 UI 수동) or 'git' (Git webhook 자동)
        }
        
        # 옵션: 커스텀 LLM 엔드포인트/키
        if getattr(payload, "llm_endpoint_url", None):
            params['LLM_ENDPOINT_URL'] = payload.llm_endpoint_url
        if getattr(payload, "llm_api_key", None):
            params['LLM_API_KEY'] = payload.llm_api_key
        # 옵션: 이메일 알림 수신자 (콤마 리스트로 전달)
        notify_emails = []
        if getattr(payload, "notify_emails", None):
            notify_emails = [email.strip() for email in payload.notify_emails if email and email.strip()]
        if notify_emails:
            params['NOTIFY_EMAILS'] = ",".join(notify_emails)
        
        # 디버깅: 전달할 파라미터 로그 출력
        logger.info(f"[JENKINS TRIGGER] Triggering build for job: {project.jenkins_job_name}")
        logger.info(f"[JENKINS TRIGGER] SCAN_ID: {new_scan.id}, PROJECT_ID: {project_id}")
        logger.info(f"[JENKINS TRIGGER] Parameters: {params}")

        try:
            result = client.trigger_build(params, job_name=project.jenkins_job_name)
            # running으로 전환
            new_scan.status = 'running'
            db.commit()
            db.refresh(new_scan)
            # queue_url은 필요 시 scan_results에 저장
            new_scan.scan_results = {**(new_scan.scan_results or {}), "jenkins_queue_url": result.get('queue_url')}
            db.commit()
            db.refresh(new_scan)
        except Exception as e:
            error_msg = str(e)
            # Script approval 에러인 경우 더 명확한 메시지 제공
            if "UnapprovedUsageException" in error_msg or "script not yet approved" in error_msg.lower():
                error_detail = (
                    "Jenkins script approval required. "
                    f"Please approve scripts at: {client.base_url}/scriptApproval "
                    "or contact Jenkins administrator."
                )
                new_scan.status = 'failed'
                new_scan.error_message = error_detail
                db.commit()
                db.refresh(new_scan)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=error_detail
                )
            
            new_scan.status = 'failed'
            new_scan.error_message = f"Jenkins trigger failed: {error_msg}"
            db.commit()
            db.refresh(new_scan)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=error_msg)

        return new_scan

    @staticmethod
    def ingest_results(
        db: Session,
        project_id: int,
        scan_id: int,
        payload: IngestScanResults,
        callback_secret_header: str,
        expected_secret: str,
    ) -> Scan:
        # Callback authentication
        if expected_secret and callback_secret_header != expected_secret:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid callback secret")

        scan = db.query(Scan).filter(Scan.id == scan_id, Scan.project_id == project_id).first()
        if not scan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        # Update results and status
        scan.scan_results = {
            **(scan.scan_results or {}),
            **{k: v for k, v in payload.model_dump(exclude_none=True).items()}
        }

        logger.info(
            "[INGEST] Scan %s: raw payload keys=%s has_vulns=%s has_structured=%s",
            scan_id,
            list(payload.model_dump(exclude_none=True).keys()),
            bool(payload.vulnerabilities),
            bool(getattr(payload, "structured_result", None)),
        )

        # Derive status - main.py의 status 필드 기준으로 처리
        if payload.status:
            if payload.status in ("error", "failed"):
                scan.status = 'failed'
                scan.completed_at = datetime.now()
            elif payload.status in ("success", "completed"):
                scan.status = 'completed'
                scan.completed_at = datetime.now()
        else:
            # status 필드가 없으면 content 존재 여부로 판단
            if payload.content:
                scan.status = 'completed'
                scan.completed_at = datetime.now()
            else:
                scan.status = 'failed'
                scan.completed_at = datetime.now()

        # 취약점 개수 파싱 (content에서 추출)
        vulnerability_names = {
            'critical': [],
            'high': [],
            'medium': [],
            'low': []
        }
        total_vulnerabilities = 0
        summary_counts = None
        structured_result = None
        vulnerabilities_list = None

        # 방법 1: payload에 직접 vulnerabilities 배열이 있는 경우 (새로운 형식)
        if payload.vulnerabilities and isinstance(payload.vulnerabilities, list):
            vulnerabilities_list = payload.vulnerabilities
            logger.info(
                "[VULN PARSING] Scan %s: payload.vulnerabilities len=%s sample_keys=%s",
                scan_id,
                len(vulnerabilities_list),
                list(vulnerabilities_list[0].keys()) if vulnerabilities_list and isinstance(vulnerabilities_list[0], dict) else None,
            )
            
            # 새로운 형식을 structured_result 형식으로 변환
            structured_result = {
                "vulnerabilities": vulnerabilities_list,
                "scan_summary": {
                    "total_findings": payload.vulnerability_count or len(vulnerabilities_list),
                    "critical": 0,
                    "high": 0,
                    "medium": 0,
                    "low": 0
                }
            }
            
            # 심각도별 카운트 계산 및 필드명 매핑
            for vuln in vulnerabilities_list:
                if not isinstance(vuln, dict):
                    continue
                # 필드명 매핑: vulnerability_title -> title
                title = vuln.get('vulnerability_title') or vuln.get('title', '')
                severity = str(vuln.get('severity', 'medium')).strip().lower()
                
                if severity in ['critical', 'high', 'medium', 'low']:
                    structured_result['scan_summary'][severity] = structured_result['scan_summary'].get(severity, 0) + 1
                    if title and title not in vulnerability_names[severity]:
                        vulnerability_names[severity].append(title)

        # 방법 2: content에서 JSON 파싱 (기존 형식 또는 새로운 형식)
        elif payload.content:
            try:
                parsed_content = json.loads(payload.content)
                
                # 새로운 형식: 직접 vulnerabilities 배열
                if isinstance(parsed_content, dict) and isinstance(parsed_content.get('vulnerabilities'), list):
                    vulnerabilities_list = parsed_content['vulnerabilities']
                    structured_result = {
                        "vulnerabilities": vulnerabilities_list,
                        "scan_summary": {
                            "total_findings": parsed_content.get('vulnerability_count', len(vulnerabilities_list)),
                            "critical": 0,
                            "high": 0,
                            "medium": 0,
                            "low": 0
                        }
                    }
                    
                    # 심각도별 카운트 계산 및 필드명 매핑
                    for vuln in vulnerabilities_list:
                        if not isinstance(vuln, dict):
                            continue
                        title = vuln.get('vulnerability_title') or vuln.get('title', '')
                        severity = str(vuln.get('severity', 'medium')).strip().lower()
                        
                        if severity in ['critical', 'high', 'medium', 'low']:
                            structured_result['scan_summary'][severity] = structured_result['scan_summary'].get(severity, 0) + 1
                            if title and title not in vulnerability_names[severity]:
                                vulnerability_names[severity].append(title)
                
                # 기존 형식: structured_result.vulnerabilities
                elif isinstance(parsed_content, dict) and parsed_content.get('structured_result'):
                    structured_result = parsed_content.get('structured_result')
                    if isinstance(structured_result, dict) and structured_result.get('vulnerabilities'):
                        vulnerabilities_list = structured_result.get('vulnerabilities', [])
                
                # 기존 형식: 직접 structured_result 형식
                elif isinstance(parsed_content, dict) and parsed_content.get('vulnerabilities'):
                    structured_result = parsed_content
                    vulnerabilities_list = parsed_content.get('vulnerabilities', [])
                    
            except json.JSONDecodeError:
                structured_result = None
                logger.warning(f"[VULN PARSING] Scan {scan_id}: Failed to parse content as JSON")

        # structured_result가 있으면 처리 (기존 로직 유지)
        if structured_result and isinstance(structured_result, dict) and structured_result.get('vulnerabilities'):
            if not vulnerabilities_list:
                vulnerabilities_list = structured_result.get('vulnerabilities', [])
            
            # 기존 형식 처리 (필드명 매핑 없이)
            if not payload.vulnerabilities and not (payload.content and 'vulnerability_title' in str(payload.content)):
                for vuln in vulnerabilities_list:
                    if not isinstance(vuln, dict):
                        continue
                    title = str(vuln.get('title', '')).strip()
                    severity = str(vuln.get('severity', '')).strip().lower()
                    if title and severity in vulnerability_names:
                        if title not in vulnerability_names[severity]:
                            vulnerability_names[severity].append(title)
            else:
                # 새로운 형식 처리 (필드명 매핑)
                for vuln in vulnerabilities_list:
                    if not isinstance(vuln, dict):
                        continue
                    title = str(vuln.get('vulnerability_title') or vuln.get('title', '')).strip()
                    severity = str(vuln.get('severity', 'medium')).strip().lower()
                    if severity not in ['critical', 'high', 'medium', 'low']:
                        severity = 'medium'
                    if title and severity in vulnerability_names:
                        if title not in vulnerability_names[severity]:
                            vulnerability_names[severity].append(title)

            summary = structured_result.get('scan_summary') or {}
            if isinstance(summary, dict):
                summary_counts = {
                    'critical': int(summary.get('critical', len(vulnerability_names['critical']))),
                    'high': int(summary.get('high', len(vulnerability_names['high']))),
                    'medium': int(summary.get('medium', len(vulnerability_names['medium']))),
                    'low': int(summary.get('low', len(vulnerability_names['low']))),
                }
                total_vulnerabilities = int(summary.get('total_findings', sum(summary_counts.values())))
            else:
                total_vulnerabilities = sum(len(v) for v in vulnerability_names.values())
                summary_counts = {
                    'critical': len(vulnerability_names['critical']),
                    'high': len(vulnerability_names['high']),
                    'medium': len(vulnerability_names['medium']),
                    'low': len(vulnerability_names['low']),
                }

            # structured_result를 정규화하여 저장 (필드명 통일)
            def build_patch_object(vuln):
                """LangGraph의 recommendation과 taint_flow_analysis를 patch 객체로 변환"""
                patch = vuln.get('patch', {})
                
                # 이미 patch 객체가 있으면 그대로 사용
                if patch and isinstance(patch, dict) and patch.get('summary'):
                    return patch
                
                # recommendation 필드에서 patch 정보 추출
                recommendation = vuln.get('recommendation', {})
                if not isinstance(recommendation, dict):
                    recommendation = {}
                
                how_to_fix = recommendation.get('how_to_fix', '')
                code_example_fix = recommendation.get('code_example_fix', '')
                
                # how_to_fix를 summary와 steps로 분리
                # 줄바꿈이나 번호가 있으면 steps로, 없으면 summary로
                steps = []
                summary = ''
                
                if how_to_fix:
                    # 줄바꿈으로 분리된 단계들 추출
                    lines = [line.strip() for line in str(how_to_fix).split('\n') if line.strip()]
                    numbered_steps = [line for line in lines if re.match(r'^\d+[\.\)]\s+', line)]
                    
                    if numbered_steps:
                        # 번호가 있는 단계들
                        steps = [re.sub(r'^\d+[\.\)]\s+', '', step) for step in numbered_steps]
                        summary = lines[0] if lines else how_to_fix
                    elif len(lines) > 1:
                        # 여러 줄이면 첫 줄을 summary, 나머지를 steps
                        summary = lines[0]
                        steps = lines[1:]
                    else:
                        # 한 줄이면 summary로
                        summary = how_to_fix
                
                # taint_flow_analysis에서 code_snippet 수집 (code_context용)
                taint_flow = vuln.get('taint_flow_analysis') or vuln.get('taint_flow', {})
                code_context_parts = []
                
                if isinstance(taint_flow, dict):
                    for key in ['source', 'propagation', 'sink']:
                        if key in taint_flow and isinstance(taint_flow[key], dict):
                            code_snippet = taint_flow[key].get('code_snippet', '')
                            if code_snippet:
                                code_context_parts.append(f"// {key.upper()}\n{code_snippet}")
                
                code_context = '\n\n'.join(code_context_parts) if code_context_parts else ''
                
                # location에서 file_path와 line_number 추출
                location = vuln.get('location', {})
                if isinstance(location, dict):
                    file_path = location.get('file_path') or vuln.get('file_path', 'N/A')
                    line_number = location.get('line_number') or vuln.get('line_number', 'N/A')
                else:
                    file_path = vuln.get('file_path', 'N/A')
                    line_number = vuln.get('line_number', 'N/A')
                
                # code_context_range 생성 (line_number가 범위인 경우)
                code_context_range = None
                if line_number and line_number != 'N/A':
                    # "103-108" 형식 파싱
                    range_match = re.match(r'(\d+)-(\d+)', str(line_number))
                    if range_match:
                        code_context_range = {
                            "context_start": int(range_match.group(1)),
                            "context_end": int(range_match.group(2))
                        }
                    else:
                        # 단일 라인
                        try:
                            line_num = int(str(line_number).split('-')[0])
                            code_context_range = {
                                "context_start": line_num,
                                "context_end": line_num
                            }
                        except:
                            pass
                
                # proof_of_concept에서 참고 자료 추출 (선택적)
                references = []
                poc = vuln.get('proof_of_concept', {})
                if isinstance(poc, dict) and poc.get('example'):
                    # example에 URL이 있으면 참고 자료로 추가
                    example = str(poc.get('example', ''))
                    url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
                    urls = re.findall(url_pattern, example)
                    references.extend(urls)
                
                return {
                    "summary": summary or (how_to_fix if how_to_fix else ''),
                    "steps": steps if steps else (how_to_fix.split('\n') if how_to_fix else []),
                    "code_diff": code_example_fix or '',
                    "code_context": code_context,
                    "code_context_range": code_context_range,
                    "references": references
                }
            
            # 취약점 데이터 정규화 (번역은 jg/lang_discovery의 analysis agent에서 처리)
            # 백엔드에서는 정규화만 수행하고, 번역은 원본 생성 시점에 처리하는 것이 효율적
            normalized_vulnerabilities = []
            for v in vulnerabilities_list:
                if not isinstance(v, dict):
                    continue
                
                # 기본 정규화
                normalized_vuln = {
                    # 필드명 정규화: vulnerability_title -> title
                    "title": v.get('vulnerability_title') or v.get('title', ''),
                    "severity": str(v.get('severity', 'medium')).strip().lower(),
                    "cwe": v.get('cwe', 'N/A'),
                    # location 객체에서 file_path와 line_number 추출
                    "file_path": (
                        (v.get('location', {}).get('file_path') if isinstance(v.get('location'), dict) else None) 
                        or v.get('file_path', 'N/A')
                    ),
                    "line_number": (
                        (v.get('location', {}).get('line_number') if isinstance(v.get('location'), dict) else None)
                        or v.get('line_number', 'N/A')
                    ),
                    "description": v.get('description', ''),
                    "code_snippet": v.get('code_snippet', ''),
                    "remediation": v.get('remediation', []),
                    # recommendation을 patch 객체로 변환
                    "patch": build_patch_object(v),
                    "taint_flow": v.get('taint_flow_analysis') or v.get('taint_flow', {}),
                    # 원본 데이터 보존
                    "recommendation": v.get('recommendation', {}),
                    "proof_of_concept": v.get('proof_of_concept', {}),
                    "code_fix_patch": v.get('code_fix_patch', {}),

                }
                
                normalized_vulnerabilities.append(normalized_vuln)
            
            normalized_structured_result = {
                "vulnerabilities": normalized_vulnerabilities,
                "scan_summary": {
                    "total_findings": total_vulnerabilities,
                    "critical": summary_counts['critical'],
                    "high": summary_counts['high'],
                    "medium": summary_counts['medium'],
                    "low": summary_counts['low']
                }
            }
            
            scan.scan_results['structured_result'] = normalized_structured_result
            scan.scan_results['content_format'] = 'json'
            if structured_result.get('taint_flow') is not None:
                scan.scan_results['taint_flow'] = structured_result['taint_flow']
        
        # 방법 3: 텍스트 파싱 (fallback)
        if not structured_result and payload.content:
            content = payload.content
            
            # 방법 1: "심각도", "Severity" 뒤에 오는 Critical/High/Medium/Low 카운트
            # 다양한 형식 지원: "심각도: **High**", "**심각도**: **Critical**", "- **심각도**: **High**"
            critical_patterns = [
                r'심각도[:\s]*\*{0,2}\s*\*{0,2}\s*critical\*{0,2}',  # 한국어
                r'severity[:\s]*\*{0,2}\s*\*{0,2}\s*critical\*{0,2}',  # 영어
                r'\*{0,2}심각도\*{0,2}[:\s]*\*{0,2}\s*critical\*{0,2}',  # 볼드 심각도
            ]
            high_patterns = [
                r'심각도[:\s]*\*{0,2}\s*\*{0,2}\s*high\*{0,2}',
                r'severity[:\s]*\*{0,2}\s*\*{0,2}\s*high\*{0,2}',
                r'\*{0,2}심각도\*{0,2}[:\s]*\*{0,2}\s*high\*{0,2}',
            ]
            medium_patterns = [
                r'심각도[:\s]*\*{0,2}\s*\*{0,2}\s*medium\*{0,2}',
                r'severity[:\s]*\*{0,2}\s*\*{0,2}\s*medium\*{0,2}',
                r'\*{0,2}심각도\*{0,2}[:\s]*\*{0,2}\s*medium\*{0,2}',
            ]
            low_patterns = [
                r'심각도[:\s]*\*{0,2}\s*\*{0,2}\s*low\*{0,2}',
                r'severity[:\s]*\*{0,2}\s*\*{0,2}\s*low\*{0,2}',
                r'\*{0,2}심각도\*{0,2}[:\s]*\*{0,2}\s*low\*{0,2}',
            ]
            
            critical_count = sum(len(re.findall(pattern, content, re.IGNORECASE)) for pattern in critical_patterns)
            high_count = sum(len(re.findall(pattern, content, re.IGNORECASE)) for pattern in high_patterns)
            medium_count = sum(len(re.findall(pattern, content, re.IGNORECASE)) for pattern in medium_patterns)
            low_count = sum(len(re.findall(pattern, content, re.IGNORECASE)) for pattern in low_patterns)
            
            # 방법 2: "N critical", "N high" 형식 (Fallback)
            if critical_count == 0:
                critical_match = re.search(r'(\d+)\s*critical', content, re.IGNORECASE)
                if critical_match:
                    critical_count = int(critical_match.group(1))
            
            if high_count == 0:
                high_match = re.search(r'(\d+)\s*high', content, re.IGNORECASE)
                if high_match:
                    high_count = int(high_match.group(1))
            
            if medium_count == 0:
                medium_match = re.search(r'(\d+)\s*(medium|med)', content, re.IGNORECASE)
                if medium_match:
                    medium_count = int(medium_match.group(1))
            
            if low_count == 0:
                low_match = re.search(r'(\d+)\s*low', content, re.IGNORECASE)
                if low_match:
                    low_count = int(low_match.group(1))
            
            # 취약점 이름 추출 (심각도별로 분류) - 개수 계산보다 먼저!
            # ... 기존 텍스트 파싱 로직 유지 ...
            
            # (텍스트 파싱 로직 전체를 기존과 동일하게 유지)
            # -- 기존 코드 시작 --
            #
            # 디버그: content 첫 500자 로깅
            logger.info(f"[VULN PARSING] Scan {scan_id}: content preview (first 500 chars):")
            logger.info(content[:500] if len(content) > 500 else content)
            
            content_before_remediation = content
            remediation_patterns = [
                r'\n#{1,3}\s*\*{0,2}추가\s*검토\s*권장\s*사항\*{0,2}',
                r'\n#{1,3}\s*\*{0,2}추가\s*권장\s*사항\*{0,2}',
                r'\n#{1,3}\s*\*{0,2}권장\s*사항\*{0,2}',
                r'\n#{1,3}\s*\*{0,2}조치\s*권고\*{0,2}',
                r'\n#{1,3}\s*\*{0,2}조치\s*방법\*{0,2}',
                r'\n#{1,3}\s*\*{0,2}조치방법\*{0,2}',
                r'\n#{1,3}\s*\*{0,2}권고\s*사항\*{0,2}',
                r'\n#{1,3}\s*\*{0,2}대응\s*방안\*{0,2}',
                r'\n---\s*\n#{0,3}\s*\*{0,2}조치',
            ]
            for pattern in remediation_patterns:
                remediation_split = re.split(pattern, content, flags=re.IGNORECASE)
                if len(remediation_split) > 1:
                    content_before_remediation = remediation_split[0]
                    break
            
            list_vuln_pattern = r'^\s*(\d+)\.\s*\*{0,2}([^(\n]+?)\*{0,2}\s*\(([^)]+)\)'
            list_matches = re.findall(list_vuln_pattern, content_before_remediation, re.MULTILINE | re.IGNORECASE)
            
            markdown_vuln_pattern = r'#{2,4}\s*(?:\d+\.)+\d*\s*\*{0,2}([^(\n]+?)\*{0,2}\s*\(([^)]+)\)'
            markdown_matches = re.findall(markdown_vuln_pattern, content_before_remediation, re.IGNORECASE)
            
            logger.info(f"[VULN PARSING] Scan {scan_id}: list_matches found: {len(list_matches)}")
            logger.info(f"[VULN PARSING] Scan {scan_id}: markdown_matches found: {len(markdown_matches)}")
            if list_matches:
                logger.info(f"[VULN PARSING] Scan {scan_id}: First 3 list matches: {list_matches[:3]}")
            if markdown_matches:
                logger.info(f"[VULN PARSING] Scan {scan_id}: First 3 markdown matches: {markdown_matches[:3]}")
            
            if list_matches:
                for vuln_num, vuln_title, severity_str in list_matches:
                    vuln_title = vuln_title.replace('**', '').strip()
                    vuln_title = vuln_title.rstrip('취약점').strip()
                    vuln_title = re.sub(r'\s*\([^)]*\)\s*$', '', vuln_title).strip()
                    severity_lower = severity_str.strip().lower()
                    if vuln_title in ['발견된', '개선', '추가', '조사', '필요', '권고', '대응', '방법'] or len(vuln_title) < 3:
                        continue
                    if 'critical' in severity_lower or '긴급' in severity_lower:
                        vulnerability_names['critical'].append(vuln_title)
                    elif 'high' in severity_lower or '높음' in severity_lower:
                        vulnerability_names['high'].append(vuln_title)
                    elif 'medium' in severity_lower or '중간' in severity_lower or '보통' in severity_lower:
                        vulnerability_names['medium'].append(vuln_title)
                    elif 'low' in severity_lower or '낮음' in severity_lower:
                        vulnerability_names['low'].append(vuln_title)
            elif markdown_matches:
                for vuln_title, severity_str in markdown_matches:
                    vuln_title = vuln_title.replace('**', '').strip()
                    vuln_title = vuln_title.rstrip('취약점').strip()
                    vuln_title = re.sub(r'^\d+\.\d*\s*', '', vuln_title).strip()
                    severity_lower = severity_str.strip().lower()
                    if vuln_title in ['발견된', '개선', '추가', '조사', '필요', '권고', '대응', '방법'] or len(vuln_title) < 3:
                        continue
                    if 'critical' in severity_lower or '긴급' in severity_lower:
                        vulnerability_names['critical'].append(vuln_title)
                    elif 'high' in severity_lower or '높음' in severity_lower:
                        vulnerability_names['high'].append(vuln_title)
                    elif 'medium' in severity_lower or '중간' in severity_lower or '보통' in severity_lower:
                        vulnerability_names['medium'].append(vuln_title)
                    elif 'low' in severity_lower or '낮음' in severity_lower:
                        vulnerability_names['low'].append(vuln_title)
            
            if not any(vulnerability_names.values()):
                vuln_title_pattern = r'\*{0,2}취약점\s*(\d+)[:\s]+([^\(\n]+)\s*\(([^(\n]+)\)\*{0,2}'
                vuln_matches = re.findall(vuln_title_pattern, content_before_remediation, re.IGNORECASE)
                if vuln_matches:
                    for vuln_num, vuln_title, severity_str in vuln_matches:
                        vuln_title = vuln_title.strip()
                        severity_lower = severity_str.strip().lower()
                        if 'critical' in severity_lower or '긴급' in severity_lower:
                            vulnerability_names['critical'].append(vuln_title)
                        elif 'high' in severity_lower or '높음' in severity_lower:
                            vulnerability_names['high'].append(vuln_title)
                        elif 'medium' in severity_lower or '중간' in severity_lower or '보통' in severity_lower:
                            vulnerability_names['medium'].append(vuln_title)
                        elif 'low' in severity_lower or '낮음' in severity_lower:
                            vulnerability_names['low'].append(vuln_title)
            
            if not any(vulnerability_names.values()):
                section_pattern = r'(?:^|\n)#{0,4}\s*\*{0,2}\s*(\d+)\.\s*\*{0,2}\s*(.+?)\*{0,2}\s*\n(.*?)(?=\n#{0,4}\s*\*{0,2}\s*\d+\.|---|\Z)'
                sections = re.findall(section_pattern, content_before_remediation, re.DOTALL | re.MULTILINE)
            else:
                sections = []
            
            for section_num, section_title, section_body in sections:
                section_title = section_title.strip()
                section_title = re.sub(r'\s*\((Critical|High|Medium|Low|긴급|높음|중간|낮음)\)\s*$', '', section_title, flags=re.IGNORECASE)
                section_title = re.sub(r'\s*취약점\s*$', '', section_title)
                section_body_lower = section_body.lower()
                exclude_keywords = ['검사 결과', '발견되지 않음', '조치 권고', '분석 도구', '추가 조사', '다음 단계', '방지', '권고']
                if any(keyword in section_title for keyword in exclude_keywords):
                    continue
                if '발견되지 않음' in section_body_lower or '없음' in section_body_lower[:200]:
                    continue
                vuln_keywords = ['xss', 'csrf', 'sql', 'idor', 'redirect', 'injection', 
                                 'scripting', 'authentication', 'authorization', 'ssrf', 'rce',
                                 'execution', 'traversal', 'overflow', 'deserialization',
                                 '취약점', 'vulnerability', '보호 미비', '검증 부족', '미비', 'bypass']
                if not any(keyword in section_title.lower() for keyword in vuln_keywords):
                    continue
                severity_pattern = r'\*{0,2}심각도\*{0,2}\s*:\s*\*{0,2}(Critical|High|Medium|Low|긴급|높음|중간|낮음)\*{0,2}'
                severity_matches = re.findall(severity_pattern, section_body, re.IGNORECASE)
                if severity_matches:
                    for severity in severity_matches:
                        severity_lower = severity.lower()
                        if severity_lower in ['critical', '긴급']:
                            vulnerability_names['critical'].append(section_title)
                        elif severity_lower in ['high', '높음']:
                            vulnerability_names['high'].append(section_title)
                        elif severity_lower in ['medium', '중간', '보통']:
                            vulnerability_names['medium'].append(section_title)
                        elif severity_lower in ['low', '낮음']:
                            vulnerability_names['low'].append(section_title)
                else:
                    section_body_lower = section_body.lower()
                    severity_found = False
                    if 'critical' in section_body_lower[:500] or '긴급' in section_body[:500]:
                        vulnerability_names['critical'].append(section_title)
                        severity_found = True
                    elif 'high' in section_body_lower[:500] or '높음' in section_body[:500] or '높은' in section_body[:500]:
                        vulnerability_names['high'].append(section_title)
                        severity_found = True
                    elif 'medium' in section_body_lower[:500] or '중간' in section_body[:500] or '보통' in section_body[:500]:
                        vulnerability_names['medium'].append(section_title)
                        severity_found = True
                    elif 'low' in section_body_lower[:500] or '낮음' in section_body[:500] or '낮은' in section_body[:500]:
                        vulnerability_names['low'].append(section_title)
                        severity_found = True
                    if not severity_found:
                        title_pos = content.find(section_title)
                        if title_pos != -1:
                            context = content[max(0, title_pos-200):min(len(content), title_pos+500)].lower()
                            if 'critical' in context or '긴급' in context:
                                vulnerability_names['critical'].append(section_title)
                            elif 'high' in context or '높음' in context or '높은' in context:
                                vulnerability_names['high'].append(section_title)
                            elif 'medium' in context or '중간' in context or '보통' in context:
                                vulnerability_names['medium'].append(section_title)
                            elif 'low' in context or '낮음' in context or '낮은' in context:
                                vulnerability_names['low'].append(section_title)
            
            for severity in vulnerability_names:
                seen = set()
                unique_list = []
                for item in vulnerability_names[severity]:
                    if item not in seen:
                        seen.add(item)
                        unique_list.append(item)
                vulnerability_names[severity] = unique_list
            
            if not summary_counts:
                summary_counts = {
                    'critical': critical_count or len(vulnerability_names['critical']),
                    'high': high_count or len(vulnerability_names['high']),
                    'medium': medium_count or len(vulnerability_names['medium']),
                    'low': low_count or len(vulnerability_names['low']),
                }
                total_vulnerabilities = sum(summary_counts.values())

            scan.critical = summary_counts['critical'] if summary_counts else len(vulnerability_names['critical'])
            scan.high = summary_counts['high'] if summary_counts else len(vulnerability_names['high'])
            scan.medium = summary_counts['medium'] if summary_counts else len(vulnerability_names['medium'])
            scan.low = summary_counts['low'] if summary_counts else len(vulnerability_names['low'])
            scan.vulnerabilities_found = total_vulnerabilities or sum(len(v) for v in vulnerability_names.values())

            logger.info(f"[VULN PARSING] Scan {scan_id}: Parsed vulnerability counts -> critical:{scan.critical}, high:{scan.high}, medium:{scan.medium}, low:{scan.low}")

            scan.scan_results['vulnerability_names'] = vulnerability_names
            flag_modified(scan, 'scan_results')

            if scan.vulnerabilities_found == 0:
                logger.warning(f"[VULN PARSING] Scan {scan_id}: 취약점이 감지되지 않았습니다.")
            
            # 심각도 없이 파일만 언급된 경우 (IDOR, XSS 등)
            if scan.vulnerabilities_found == 0:
                # "취약한 파일", "vulnerable file" 패턴 찾기
                file_patterns = [
                    r'취약한\s*파일.*?:\s*\n\s*-\s*(.*?)(?:\n|$)',  # 한국어
                    r'vulnerable\s*file.*?:\s*\n\s*-\s*(.*?)(?:\n|$)',  # 영어
                    r'\d+\.\s*취약한\s*파일',  # "1. 취약한 파일" 형식
                    r'파일.*?:\d+.*?\(',  # "shop/views.py:131" 형식
                ]
                
                vuln_files = []
                for pattern in file_patterns:
                    matches = re.findall(pattern, content, re.MULTILINE)
                    vuln_files.extend(matches)
                
                # 라인 번호 패턴 카운트 (파일명:라인번호)
                line_refs = re.findall(r'\w+/\w+\.py:\d+', content)
                
                if vuln_files or line_refs:
                    # 발견된 취약점 파일 개수만큼 설정
                    count = max(len(vuln_files), len(line_refs))
                    scan.vulnerabilities_found = count
                    # 기본 심각도는 Medium으로 설정
                    scan.medium = count

        db.commit()
        db.refresh(scan)
        
        # ===== 새로운 기능: 취약점 및 분석 결과 저장 =====
        if scan.scan_results and isinstance(scan.scan_results, dict):
            raw_vulnerabilities = scan.scan_results.get('vulnerabilities')
            structured_vulnerabilities = None
            structured_result = scan.scan_results.get('structured_result')
            if isinstance(structured_result, dict):
                structured_vulnerabilities = structured_result.get('vulnerabilities')

        vulnerabilities_data = raw_vulnerabilities or structured_vulnerabilities or []
        if isinstance(vulnerabilities_data, dict):
            vulnerabilities_data = [vulnerabilities_data]
        elif not isinstance(vulnerabilities_data, list):
            vulnerabilities_data = []

        logger.info(
            "[INGEST] Scan %s: normalized vulnerabilities_data len=%s raw_count=%s structured_count=%s",
            scan_id,
            len(vulnerabilities_data),
            len(raw_vulnerabilities or []) if isinstance(raw_vulnerabilities, list) else (1 if isinstance(raw_vulnerabilities, dict) else 0),
            len(structured_vulnerabilities or []) if isinstance(structured_vulnerabilities, list) else (1 if isinstance(structured_vulnerabilities, dict) else 0),
        )

        # 최신 스캔 결과와 동기화하기 위해 기존 레코드를 제거
        # 방어적 프로그래밍: scan_id와 project_id 모두 확인하여 다른 프로젝트의 데이터가 삭제되지 않도록 함
        if vulnerabilities_data:
            logger.info("[INGEST] Scan %s: deleting existing vulnerabilities/analysis_results before insert", scan.id)
            db.query(Vulnerability).filter(
                Vulnerability.scan_id == scan.id,
                Vulnerability.project_id == project_id
            ).delete(synchronize_session=False)
            db.query(AnalysisResult).filter(
                AnalysisResult.scan_id == scan.id
            ).delete(synchronize_session=False)
        else:
            logger.warning("[INGEST] Scan %s: vulnerabilities_data empty -> skip delete/insert to preserve existing rows", scan.id)
            db.commit()
            db.refresh(scan)
            return scan

        project_title = (
            payload.project
            or scan.scan_results.get('project')
            or getattr(project, "name", None)
            or f"project-{project_id}"
        )

        # 중복 제거를 위한 Dict: key는 (file_path, line_range), value는 (severity, cwe, vuln_data)
        # 같은 파일 + 같은 라인 번호면 CWE가 달라도 하나만 표시 (심각도가 높은 것 우선)
        seen_vulns_by_location = {}
        severity_stats = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        inserted_count = 0

        # 심각도 우선순위 (숫자가 낮을수록 높은 우선순위)
        severity_priority = {"critical": 1, "high": 2, "medium": 3, "low": 4, "info": 5}

        # 1단계: 모든 취약점을 수집하고 중복 제거
        for vuln_data in vulnerabilities_data:
            if not isinstance(vuln_data, dict):
                continue

            title_value = vuln_data.get('vulnerability_title') or vuln_data.get('title')
            if not title_value:
                continue

            location = vuln_data.get('location', {}) if isinstance(vuln_data.get('location'), dict) else {}
            raw_file_path = (
                vuln_data.get('file_path')
                or location.get('file_path')
                or 'N/A'
            )
            # 파일 경로 정규화: 절대 경로를 상대 경로로 변환
            file_path = ScanService._normalize_file_path(raw_file_path)
            raw_line = vuln_data.get('line_number') or location.get('line_number') or location.get('line')
            line_number_str = str(raw_line) if raw_line not in [None, '', 'N/A'] else None
            cwe_value = vuln_data.get('cwe') or 'N/A'

            # taint_flow에서 source, sink 라인 번호 추출
            taint_flow = vuln_data.get('taint_flow_analysis') or vuln_data.get('taint_flow')
            source_line = None
            sink_line = None
            if isinstance(taint_flow, dict):
                source = taint_flow.get('source', {})
                if isinstance(source, dict):
                    source_line = source.get('line_number') or source.get('line')
                sink = taint_flow.get('sink', {})
                if isinstance(sink, dict):
                    sink_line = sink.get('line_number') or sink.get('line')

            # 라인 번호 수집: location, taint_flow.source, taint_flow.sink 등에서 모든 라인 번호 수집
            all_lines = []
            if line_number_str:
                all_lines.append(str(line_number_str))
            if source_line:
                all_lines.append(str(source_line))
            if sink_line:
                all_lines.append(str(sink_line))

            # 모든 라인 번호에서 숫자 추출 (범위 형식 "103-108"도 처리)
            line_numbers = []
            for line_str in all_lines:
                if '-' in str(line_str):
                    parts = str(line_str).split('-')
                    for part in parts:
                        line_matches = re.findall(r'\d+', part)
                        line_numbers.extend([int(m) for m in line_matches])
                else:
                    line_matches = re.findall(r'\d+', str(line_str))
                    line_numbers.extend([int(m) for m in line_matches])

            # 중복 체크를 위해 모든 라인 번호를 정렬하여 정규화
            # 같은 파일, 같은 CWE, 라인 번호가 겹치면 중복으로 간주
            normalized_lines = sorted(set(line_numbers)) if line_numbers else []
            normalized_line = str(min(normalized_lines)) if normalized_lines else None

            # 라인 범위 문자열 생성
            line_range = None
            if normalized_lines:
                line_range = f"{min(normalized_lines)}-{max(normalized_lines)}" if len(normalized_lines) > 1 else str(normalized_lines[0])

            # 심각도 추출 (나중에 비교용)
            severity_raw = vuln_data.get('severity', 'medium')
            severity = severity_raw.lower() if isinstance(severity_raw, str) else 'medium'
            if severity not in ['critical', 'high', 'medium', 'low', 'info']:
                severity = 'medium'

            # taint_flow 정규화 (중복 체크 전에 미리 계산)
            normalized_taint_flow = ScanService._normalize_taint_flow_payload(
                vuln_data.get('taint_flow_analysis') or vuln_data.get('taint_flow')
            )

            # 중복 체크: (file_path, line_range) 조합으로 판단 (CWE 제외)
            # 같은 파일 + 같은 라인 번호면 CWE가 달라도 하나만 표시
            if normalized_lines:
                # 라인 번호가 있으면 (file_path, 라인 범위)로 체크
                location_key = (
                    str(file_path).strip().lower(),
                    line_range
                )
            else:
                # 라인 번호가 없으면 제목도 고려 (같은 파일, 비슷한 제목)
                title_normalized = re.sub(r'[^\w\s]', '', str(title_value).lower()).strip()[:50]
                location_key = (
                    str(file_path).strip().lower(),
                    title_normalized
                )

            # 같은 위치에 이미 취약점이 있는지 확인
            if location_key in seen_vulns_by_location:
                existing_severity, existing_cwe, existing_vuln_data, _, _, _, _, _ = seen_vulns_by_location[location_key]
                existing_priority = severity_priority.get(existing_severity, 99)
                current_priority = severity_priority.get(severity, 99)

                # 현재 취약점이 더 심각하면 기존 것을 대체
                if current_priority < existing_priority:
                    logger.info(f"[DUPLICATE] Replacing {existing_severity} (CWE: {existing_cwe}) with {severity} (CWE: {cwe_value}) @ {file_path}:{line_range or 'N/A'}")
                    seen_vulns_by_location[location_key] = (severity, cwe_value, vuln_data, normalized_lines, line_number_str, file_path, title_value, normalized_taint_flow)
                else:
                    logger.info(f"[DUPLICATE] Skipping {severity} (CWE: {cwe_value}) - keeping {existing_severity} (CWE: {existing_cwe}) @ {file_path}:{line_range or 'N/A'}")
                continue

            # 새로운 취약점 추가
            seen_vulns_by_location[location_key] = (severity, cwe_value, vuln_data, normalized_lines, line_number_str, file_path, title_value, normalized_taint_flow)

        # 2단계: 중복 제거된 취약점들만 DB에 저장 (누적 수집 후 단 한 번 실행)
        for location_key, (severity, cwe_value, vuln_data, normalized_lines, line_number_str, file_path, title_value, normalized_taint_flow) in seen_vulns_by_location.items():
            # taint_flow의 segments에서도 파일 경로 정규화
            if normalized_taint_flow and isinstance(normalized_taint_flow, dict):
                segments = normalized_taint_flow.get('segments', [])
                if isinstance(segments, list):
                    for segment in segments:
                        if isinstance(segment, dict) and segment.get('file_path'):
                            segment['file_path'] = ScanService._normalize_file_path(segment['file_path'])

            line_number_for_db = str(min(normalized_lines)) if normalized_lines else line_number_str

            # recommendation에 code_fix_patch와 analysis_target_label 포함
            recommendation_data = vuln_data.get('recommendation', {})
            if not isinstance(recommendation_data, dict):
                recommendation_data = {}
            
            # code_fix_patch와 analysis_target_label을 recommendation에 포함
            if vuln_data.get('code_fix_patch'):
                recommendation_data['code_fix_patch'] = vuln_data.get('code_fix_patch')
            if vuln_data.get('analysis_target_label'):
                recommendation_data['analysis_target_label'] = vuln_data.get('analysis_target_label')

            new_vuln = Vulnerability(
                scan_id=scan.id,
                project_id=project_id,
                severity=severity if severity in ['critical', 'high', 'medium', 'low'] else 'medium',
                title=title_value,
                description=vuln_data.get('description'),
                cwe=cwe_value,
                file_path=file_path,
                line_number=line_number_for_db,
                taint_flow_analysis=normalized_taint_flow,
                proof_of_concept=ScanService._normalize_json_field(vuln_data.get('proof_of_concept')),
                recommendation=ScanService._normalize_json_field(recommendation_data),
                status='open'
            )
            db.add(new_vuln)

            analysis_row = AnalysisResult(
                scan_id=scan.id,
                project_title=project_title,
                file_path=file_path or 'N/A',
                line_num=line_number_for_db,
                vulnerability_title=title_value,
                severity=severity,
                cwe=cwe_value,
                description=vuln_data.get('description'),
                taint_flow=normalized_taint_flow,
                proof_of_concept=ScanService._normalize_json_field(vuln_data.get('proof_of_concept')),
                recommendation=ScanService._normalize_json_field(recommendation_data),
                functional_test=ScanService._normalize_json_field(vuln_data.get('functional_test')),
                security_regression_test=ScanService._normalize_json_field(vuln_data.get('security_regression_test')),
            )
            db.add(analysis_row)
            inserted_count += 1
            if severity in severity_stats:
                severity_stats[severity] += 1
            else:
                severity_stats['medium'] += 1  # fallback

        scan.vulnerabilities_found = inserted_count
        scan.critical = severity_stats['critical']
        scan.high = severity_stats['high']
        scan.medium = severity_stats['medium']
        scan.low = severity_stats['low']

        logger.info(
            "[INGEST] Scan %s: inserted=%s critical=%s high=%s medium=%s low=%s",
            scan.id,
            inserted_count,
            severity_stats['critical'],
            severity_stats['high'],
            severity_stats['medium'],
            severity_stats['low'],
        )

        if inserted_count == 0:
            logger.warning("[INGEST] Scan %s: payload contained 0 persisted vulnerabilities", scan.id)
        else:
            logger.info(
                "[INGEST] Scan %s: persisted %s vulnerabilities (critical=%s, high=%s, medium=%s, low=%s)",
                scan.id,
                inserted_count,
                severity_stats['critical'],
                severity_stats['high'],
                severity_stats['medium'],
                severity_stats['low'],
            )

        db.commit()
        
        # 프로젝트 통계 업데이트
        if project:
            # 해당 프로젝트의 모든 스캔 통계 재계산
            all_scans = db.query(Scan).filter(Scan.project_id == project_id).all()
            project.total_scans = len(all_scans)
            project.total_vulnerabilities = sum((s.vulnerabilities_found or 0) for s in all_scans)
            project.last_scan_at = scan.created_at
            db.commit()
        
        return scan

    @staticmethod
    def update_progress(
        db: Session,
        project_id: int,
        scan_id: int,
        payload: ScanProgressUpdate,
    ) -> Scan:
        """
        Jenkins 파이프라인에서 진행 상황을 업데이트합니다.
        scan_results JSON 필드에 progress 정보를 저장합니다.
        """
        scan = db.query(Scan).filter(Scan.id == scan_id, Scan.project_id == project_id).first()
        if not scan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

        # scan_results에 progress 정보 추가/업데이트
        current_results = scan.scan_results or {}
        progress_history = current_results.get('progress_history', [])
        
        # 새로운 진행 상황 추가
        progress_entry = {
            'stage': payload.stage,
            'status': payload.status,
            'message': payload.message,
            'progress_percent': payload.progress_percent,
            'timestamp': datetime.now().isoformat(),
        }
        progress_history.append(progress_entry)
        
        # 최신 진행 상황 업데이트
        current_results['progress'] = {
            'current_stage': payload.stage,
            'current_status': payload.status,
            'current_message': payload.message,
            'progress_percent': payload.progress_percent,
            'last_updated': datetime.now().isoformat(),
        }
        current_results['progress_history'] = progress_history
        
        scan.scan_results = current_results
        # SQLAlchemy에게 JSON 필드가 변경되었음을 명시적으로 알림
        flag_modified(scan, 'scan_results')
        
        # status가 'failed'인 경우 스캔 상태도 업데이트
        if payload.status == 'failed':
            scan.status = 'failed'
            scan.completed_at = datetime.now()
            if payload.message:
                scan.error_message = payload.message
        
        # 첫 시작 시 started_at 설정
        if not scan.started_at and payload.status == 'running':
            scan.started_at = datetime.now()
            scan.status = 'running'
        
        db.commit()
        db.refresh(scan)
        
        return scan

    @staticmethod
    def _normalize_file_path(file_path):
        """
        파일 경로를 정규화합니다.
        절대 경로(/home/ubuntu/jg/vulnshop/...)를 상대 경로로 변환합니다.
        """
        if not file_path or file_path == 'N/A':
            return file_path
        
        file_path_str = str(file_path).strip()
        
        # 절대 경로 패턴 제거
        # /home/ubuntu/jg/vulnshop/... -> ...
        # /home/ubuntu/jg/... -> ...
        patterns_to_remove = [
            r'^/home/ubuntu/jg/vulnshop/',
            r'^/home/ubuntu/jg/',
            r'^/.*?/vulnshop/',
            r'^/.*?/jg/vulnshop/',
        ]
        
        for pattern in patterns_to_remove:
            file_path_str = re.sub(pattern, '', file_path_str)
        
        # 앞의 / 제거
        file_path_str = file_path_str.lstrip('/')
        
        return file_path_str if file_path_str else 'N/A'

    @staticmethod
    def _normalize_json_field(value):
        if value is None or value == "":
            return None
        if isinstance(value, (dict, list)):
            return value
        return {"text": str(value)}

    @staticmethod
    def _normalize_taint_flow_payload(raw):
        if raw is None:
            return None

        if isinstance(raw, str):
            text = raw.strip()
            if not text:
                return None
            return {
                "description": text,
                "risk": None,
                "source": text,
                "sink": "",
                "propagation_steps": [],
                "segments": [],
            }

        if not isinstance(raw, dict):
            return None

        normalized = {
            "description": str(raw.get("description") or "").strip(),
            "risk": None,
            "source": "",
            "sink": "",
            "propagation_steps": [],
            "segments": [],
        }

        risk_value = str(raw.get("risk") or "").strip().lower()
        if risk_value in ['critical', 'high', 'medium', 'low']:
            normalized["risk"] = risk_value

        steps_payload = raw.get("propagation_steps") or raw.get("propagation") or raw.get("steps")
        if isinstance(steps_payload, list):
            steps = [
                ScanService._stringify_step(step)
                for step in steps_payload
                if ScanService._stringify_step(step)
            ]
            normalized["propagation_steps"] = steps
        elif isinstance(steps_payload, (str, dict)):
            step_value = ScanService._stringify_step(steps_payload)
            if step_value:
                normalized["propagation_steps"] = [step_value]

        segments = []
        existing_segments = raw.get("segments") if isinstance(raw.get("segments"), list) else None
        if existing_segments:
            for segment in existing_segments:
                normalized_segment = ScanService._normalize_taint_segment(segment)
                if normalized_segment:
                    segments.append(normalized_segment)
        else:
            source_segment = ScanService._normalize_taint_segment(raw.get("source"), stage="source")
            if source_segment:
                segments.append(source_segment)

            propagation_payload = raw.get("propagation") or raw.get("propagation_steps")
            if isinstance(propagation_payload, list):
                for step in propagation_payload:
                    normalized_segment = ScanService._normalize_taint_segment(step, stage="propagation")
                    if normalized_segment:
                        segments.append(normalized_segment)
            else:
                propagation_segment = ScanService._normalize_taint_segment(propagation_payload, stage="propagation")
                if propagation_segment:
                    segments.append(propagation_segment)

            sink_segment = ScanService._normalize_taint_segment(raw.get("sink"), stage="sink")
            if sink_segment:
                segments.append(sink_segment)

        normalized["segments"] = segments
        normalized["source"] = ScanService._derive_stage_label(raw.get("source"), segments, "source")
        normalized["sink"] = ScanService._derive_stage_label(raw.get("sink"), segments, "sink")

        if (
            not normalized["description"]
            and not normalized["risk"]
            and not normalized["segments"]
            and not normalized["propagation_steps"]
        ):
            return None

        return normalized

    @staticmethod
    def _normalize_taint_segment(payload, stage=None):
        if payload is None or payload == "":
            return None

        if isinstance(payload, str):
            text = payload.strip()
            if not text:
                return None
            resolved_stage = stage or "propagation"
            return {
                "stage": resolved_stage,
                "title": text,
                "line_number": "",
                "file_path": "",
                "description": text,
                "code_snippet": "",
            }

        if not isinstance(payload, dict):
            return None

        resolved_stage = stage or str(payload.get("stage") or "").strip().lower()
        if resolved_stage not in ["source", "propagation", "sink"]:
            resolved_stage = "propagation"

        title_value = (
            payload.get("title")
            or payload.get("label")
            or payload.get("name")
            or payload.get("description")
        )

        raw_segment_file_path = str(payload.get("file_path") or payload.get("path") or "").strip()
        return {
            "stage": resolved_stage,
            "title": str(title_value or "").strip(),
            "line_number": str(
                payload.get("line_number")
                or payload.get("line")
                or payload.get("line_num")
                or ""
            ).strip(),
            "file_path": ScanService._normalize_file_path(raw_segment_file_path),
            "description": str(
                payload.get("description") or payload.get("explanation") or payload.get("detail") or ""
            ).strip(),
            "code_snippet": str(payload.get("code_snippet") or payload.get("code") or "").strip(),
        }

    @staticmethod
    def _derive_stage_label(raw_stage, segments, stage_key):
        if isinstance(raw_stage, str) and raw_stage.strip():
            return raw_stage.strip()

        if isinstance(raw_stage, dict):
            for key in ("title", "label", "name", "description"):
                value = raw_stage.get(key)
                if value:
                    return str(value).strip()

        for segment in segments or []:
            if segment.get("stage") == stage_key and segment.get("title"):
                return segment["title"]

        return ""

    @staticmethod
    def _stringify_step(value):
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, (int, float)):
            return str(value)
        if isinstance(value, dict):
            for key in ("description", "detail", "title", "summary", "text"):
                if key in value and value[key]:
                    return str(value[key]).strip()
            return str(value)
        return str(value)
