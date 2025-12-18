"""
Jenkins 로그 파싱 유틸리티
- 핵심 정보만 추출하여 프론트엔드에서 시각화
"""
import re
from typing import Dict, List, Any, Optional
from datetime import datetime


def parse_jenkins_log(log_text: str) -> Dict[str, Any]:
    """
    Jenkins 콘솔 로그를 파싱하여 구조화된 데이터 반환
    
    Returns:
        {
            "stages": [...],
            "summary": {...},
            "errors": [...],
            "warnings": [...]
        }
    """
    stages = []
    errors = []
    warnings = []
    current_stage = None
    
    lines = log_text.split('\n')
    
    for line in lines:
        # Stage 시작 감지 - Jenkins 표준 형식 (더 유연하게)
        # 예: [Pipeline] stage { (Setup Environment)
        # 예: [Pipeline] { (Validate Input)
        stage_match = re.search(r'\[Pipeline\].*?\{\s*\((.*?)\)', line)
        
        if stage_match:
            stage_name = stage_match.group(1).strip()
            # 중복 방지 (이미 같은 이름의 Stage가 있으면 스킵)
            if not any(s['name'] == stage_name for s in stages):
                current_stage = {
                    "name": stage_name,
                    "status": "running",
                    "started_at": None,
                    "duration": None,
                    "key_logs": []
                }
                stages.append(current_stage)
            continue
        
        # Stage 종료 감지
        if '[Pipeline] // stage' in line and current_stage:
            # 이전 상태가 failed가 아니면 completed로 설정
            if current_stage["status"] != "failed":
                current_stage["status"] = "completed"
        
        # 에러 감지 (실제 에러만, 코드/JSON/일반 로그 제외)
        if re.search(r'ERROR:|error:|failed|Failed|FAILED|Exception|Traceback', line, re.IGNORECASE):
            # 제외 패턴: Python import, JSON 필드명, 코드, 일반 메시지
            exclude_patterns = [
                r'from\s+\w+',  # from django.core...
                r'import\s+\w+',  # import something
                r'"error',  # JSON 필드
                r'error_message',  # JSON 필드
                r'PermissionDenied',  # Django 클래스명
                r'raise\s+\w+Error',  # Python raise 구문
                r'def\s+\w+',  # 함수 정의
                r'class\s+\w+',  # 클래스 정의
                r'\.error\(',  # logger.error() 호출
                r'error_detail',  # 변수명
                r'error_msg',  # 변수명
                r'trapped\)\s+error',  # bcrypt 경고
                r'bcrypt',  # bcrypt 관련
                r'__about__',  # 모듈 속성
                r'Stage.*skipped',  # 스테이지 스킵 메시지
                r'earlier failure',  # 이전 실패로 인한 스킵
            ]
            
            # 실제 에러만 수집 (Jenkins 파이프라인 에러, 빌드 실패)
            is_real_error = (
                'ERROR:' in line or  # Jenkins ERROR
                '[Pipeline] error' in line or  # Pipeline error 단계
                'Finished: FAILURE' in line or  # 빌드 실패
                'returned status code' in line  # Git/명령어 실패
            )
            
            if is_real_error and not any(re.search(pat, line, re.IGNORECASE) for pat in exclude_patterns):
                error_line = line.strip()
                if error_line and error_line not in errors and len(error_line) < 500:  # 중복 제거 및 길이 제한
                    errors.append(error_line)
                if current_stage:
                    current_stage["status"] = "failed"
                    if len(current_stage["key_logs"]) < 5:  # 스테이지당 최대 5개 로그
                        current_stage["key_logs"].append({"type": "error", "message": error_line})
        
        # 경고 감지 (실제 경고만)
        elif re.search(r'WARNING:|warning|WARN|deprecated', line, re.IGNORECASE):
            # 제외 패턴: 일반적인 Jenkins 경고, 보안 경고
            exclude_warning_patterns = [
                r'A secret was passed',  # Jenkins 보안 경고 (정상)
                r'Groovy String interpolation',  # Jenkins 보안 경고 (정상)
                r'trapped\)\s+error',  # bcrypt 경고
                r'bcrypt',  # bcrypt 관련
                r'Skipping',  # 스킵 메시지
            ]
            
            if not any(re.search(pat, line, re.IGNORECASE) for pat in exclude_warning_patterns):
                warn_line = line.strip()
                if warn_line and warn_line not in warnings and len(warn_line) < 500:  # 중복 제거 및 길이 제한
                    warnings.append(warn_line)
                if current_stage and len(current_stage["key_logs"]) < 5:  # 스테이지당 최대 5개 로그
                    current_stage["key_logs"].append({"type": "warning", "message": warn_line})
        
        # 중요 정보 추출 (Jenkinsfile3 로그 포맷에 맞게 최적화)
        elif current_stage:
            stripped = line.strip()
            
            # 빌드 정보 (최우선)
            if any(x in line for x in ['빌드 번호:', 'Build #', 'Started by']):
                current_stage["key_logs"].append({"type": "info", "message": stripped})
            
            # 프로젝트/스캔 설정 정보
            elif any(keyword in line for keyword in [
                '프로젝트 ID:', 'Scan ID:', '스캔 타입:', 
                'API Provider:', '모델:', 'SAST', 
                'Repository:', 'Target:'
            ]):
                current_stage["key_logs"].append({"type": "info", "message": stripped})
            
            # MCP 서버 관련 (성공만)
            elif 'MCP' in line and not any(x in line.lower() for x in ['error', 'fail']):
                if any(x in line for x in ['연결', '성공', '완료', '로드', 'connected', 'loaded', 'success']):
                    current_stage["key_logs"].append({"type": "success", "message": stripped})
            
            # 분석 실행 관련
            elif any(x in line for x in ['python3 main.py', 'asyncio.run', '보안 분석 시작']):
                current_stage["key_logs"].append({"type": "info", "message": stripped})
            
            # LLM 정보
            elif any(x in line for x in ['LLM', 'ChatGroq', 'ChatOpenAI', 'Reasoning']):
                if 'error' not in line.lower():
                    current_stage["key_logs"].append({"type": "info", "message": stripped})
            
            # 도구 사용 (Tool Usage)
            elif 'Tool Usage' in line or '도구 호출' in line:
                current_stage["key_logs"].append({"type": "info", "message": stripped})
            
            # 결과 파일 발견
            elif '.json' in line and any(x in line for x in ['Found', '발견', '저장', 'saved']):
                current_stage["key_logs"].append({"type": "success", "message": stripped})
            
            # 백엔드 전송
            elif 'Posting to' in line:
                current_stage["key_logs"].append({"type": "info", "message": stripped})
            
            # curl 응답
            elif line.startswith('{') and '"id"' in line:
                # JSON 응답은 요약만
                current_stage["key_logs"].append({"type": "success", "message": "Backend callback successful"})
            
            # 성공 완료 메시지
            elif any(x in line for x in ['SUCCESS', 'Finished:', 'Completed successfully', '완료']):
                if not any(x in line.lower() for x in ['error', 'failed']):
                    current_stage["key_logs"].append({"type": "success", "message": stripped})
    
    # Summary 계산
    total_stages = len(stages)
    completed_stages = sum(1 for s in stages if s["status"] == "completed")
    failed_stages = sum(1 for s in stages if s["status"] == "failed")
    
    summary = {
        "total_stages": total_stages,
        "completed": completed_stages,
        "failed": failed_stages,
        "overall_status": "failed" if failed_stages > 0 else ("completed" if completed_stages == total_stages else "running"),
        "error_count": len(errors),
        "warning_count": len(warnings)
    }
    
    return {
        "stages": stages,
        "summary": summary,
        "errors": errors[:10],  # 최대 10개만
        "warnings": warnings[:5]  # 최대 5개만
    }


def extract_build_info(log_text: str) -> Dict[str, Any]:
    """
    로그에서 빌드 정보 추출 (Jenkinsfile3 + main.py 형식)
    """
    info = {
        "build_number": None,
        "project": None,
        "scan_type": None,
        "provider": None,
        "model": None,
        "sast_enabled": None,
    }
    
    # 빌드 번호 (여러 형식 지원)
    for pattern in [r'빌드 번호:\s*(\d+)', r'Build #(\d+)', r'BUILD_NUMBER[=\s]+(\d+)']:
        match = re.search(pattern, log_text)
        if match:
            info["build_number"] = match.group(1)
            break
    
    # 프로젝트 (여러 형식 지원)
    for pattern in [r'프로젝트:\s*(\S+)', r'Project:\s*(\S+)', r'--project\s+(\S+)']:
        match = re.search(pattern, log_text, re.IGNORECASE)
        if match:
            info["project"] = match.group(1)
            break
    
    # 스캔 타입
    for pattern in [r'스캔 타입:\s*(\S+)', r'Scan Type:\s*(\S+)', r'--type\s+(\S+)']:
        match = re.search(pattern, log_text, re.IGNORECASE)
        if match:
            info["scan_type"] = match.group(1)
            break
    
    # Provider
    for pattern in [r'API Provider:\s*(\S+)', r'--provider\s+(\S+)', r'Provider:\s*(\S+)']:
        match = re.search(pattern, log_text, re.IGNORECASE)
        if match:
            info["provider"] = match.group(1)
            break
    
    # Model (여러 줄에 걸쳐 있을 수 있음)
    for pattern in [r'모델:\s*(.+?)(?:\n|$)', r'Model:\s*(.+?)(?:\n|$)', r'--model\s+(\S+)']:
        match = re.search(pattern, log_text, re.IGNORECASE)
        if match:
            info["model"] = match.group(1).strip()
            break
    
    # SAST 실행 여부
    for pattern in [r'SAST 실행:\s*(true|false|yes|no)', r'--sast']:
        match = re.search(pattern, log_text, re.IGNORECASE)
        if match:
            if '--sast' in pattern:
                info["sast_enabled"] = True
            else:
                val = match.group(1).lower()
                info["sast_enabled"] = val in ('true', 'yes')
            break
    
    return info

