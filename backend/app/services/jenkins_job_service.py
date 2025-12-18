import os
import re
import requests
from typing import Optional, Dict, Tuple

from app.config import get_settings
from app.utils.jenkins_client import JenkinsClient


class JenkinsJobService:
    """
    Manages Jenkins job provisioning for git-triggered projects.
    """

    def __init__(self) -> None:
        self.client = JenkinsClient()
        self.settings = get_settings()
        self.default_script_path = getattr(self.settings, "JENKINS_GIT_SCRIPT_PATH", "Jenkinsfile")

    def provision_pipeline(
        self,
        project_name: str,
        trigger_mode: str,
        job_name: Optional[str] = None,
        git_url: Optional[str] = None,
        git_branch: Optional[str] = None,
        webhook_secret: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Create or update a Jenkins pipeline job for a project.
        
        Args:
            project_name: Project name
            trigger_mode: 'web' (manual trigger) or 'git' (webhook trigger)
            job_name: Optional custom job name
            git_url: Required for 'git' trigger mode
            git_branch: Required for 'git' trigger mode
            webhook_secret: Optional webhook secret for 'git' trigger mode
        
        Returns:
            Dictionary with job_name, job_url, webhook_url, webhook_id
        """
        desired_job_name = job_name or self._generate_job_name(project_name)
        
        if trigger_mode == 'git':
            if not git_url or not git_branch:
                raise ValueError("git_url and git_branch are required for git trigger mode")
            config_xml = self._build_git_pipeline_xml(git_url, git_branch)
        else:  # web trigger mode
            # Web 모드: Jenkins 컨테이너 내부의 로컬 Jenkinsfile 사용
            print(f"[DEBUG] Web trigger mode: Using readFileFromWorkspace for Jenkinsfile")
            config_xml = self._build_web_pipeline_xml_with_readfile()
            
            # Jenkinsfile 스크립트를 미리 승인 (Script Security 회피)
            # try:
            #     self._approve_jenkinsfile_script()
            # except Exception as e:
            #     print(f"[WARNING] Failed to pre-approve Jenkinsfile script: {e}")

        if self.client.job_exists(desired_job_name):
            self.client.update_job(desired_job_name, config_xml)
            final_job_name = desired_job_name
        else:
            final_job_name = self._ensure_unique_job_name(desired_job_name)
            self.client.create_job(final_job_name, config_xml)
        
        # Git trigger mode만: GitHub webhook 자동 등록
        webhook_url = None
        webhook_id = None
        if trigger_mode == 'git':
            webhook_url = self.client.get_github_webhook_endpoint()
            try:
                webhook_id = self._create_github_webhook(git_url, webhook_url, webhook_secret)
            except Exception as e:
                print(f"⚠️ Failed to auto-register GitHub webhook: {e}")
                print(f"   Please manually register webhook at: {webhook_url}")

        return {
            "job_name": final_job_name,
            "job_url": self.client.get_job_url(final_job_name),
            "webhook_url": webhook_url if trigger_mode == 'git' else None,
            "webhook_id": webhook_id,
        }

    def provision_git_pipeline(
        self,
        project_name: str,
        git_url: str,
        git_branch: str,
        job_name: Optional[str] = None,
        webhook_secret: Optional[str] = None,
    ) -> Dict[str, str]:
        """Backward compatibility wrapper for git pipeline provisioning."""
        return self.provision_pipeline(
            project_name=project_name,
            trigger_mode='git',
            job_name=job_name,
            git_url=git_url,
            git_branch=git_branch,
            webhook_secret=webhook_secret,
        )

    def delete_job(self, job_name: Optional[str]) -> None:
        if not job_name:
            return
        if self.client.job_exists(job_name):
            self.client.delete_job(job_name)

    def _generate_job_name(self, project_name: str) -> str:
        slug = re.sub(r"[^a-zA-Z0-9]+", "-", project_name).strip("-").lower()
        if not slug:
            slug = "project"
        # 접두사 없이 프로젝트 이름 그대로 사용
        return slug

    def _ensure_unique_job_name(self, base_name: str) -> str:
        candidate = base_name
        suffix = 1
        while self.client.job_exists(candidate):
            suffix += 1
            candidate = f"{base_name}-{suffix}"
        return candidate

    def _extract_github_repo_info(self, git_url: str) -> Tuple[str, str]:
        """
        GitHub URL에서 owner와 repo 이름 추출
        
        Args:
            git_url: GitHub repository URL (https://github.com/owner/repo.git 또는 git@github.com:owner/repo.git)
        
        Returns:
            (owner, repo) 튜플
        """
        # 슬래시와 .git 제거 (.git은 정확히 매칭해야 함)
        url = git_url.rstrip('/')
        if url.endswith('.git'):
            url = url[:-4]  # .git 제거 (rstrip 대신 슬라이싱 사용)
        
        # SSH 형식 변환 (git@github.com:owner/repo -> https://github.com/owner/repo)
        if url.startswith('git@'):
            url = url.replace('git@github.com:', 'https://github.com/')
        
        # HTTPS 형식에서 owner/repo 추출
        if 'github.com/' in url:
            parts = url.split('github.com/')[-1].split('/')
            if len(parts) >= 2:
                return parts[0], parts[1]
        
        raise ValueError(f"Invalid GitHub URL format: {git_url}")

    def _create_github_webhook(
        self,
        git_url: str,
        webhook_url: str,
        webhook_secret: Optional[str] = None
    ) -> Optional[str]:
        """
        GitHub API를 사용하여 webhook 자동 등록
        
        Args:
            git_url: GitHub repository URL
            webhook_url: Jenkins webhook endpoint URL
            webhook_secret: Webhook secret (선택사항)
        
        Returns:
            Webhook ID (등록 성공 시), None (실패 시)
        """
        # GitHub Personal Access Token 가져오기
        # Jenkins credentials에서 가져오거나 환경 변수에서 가져올 수 있음
        github_token = getattr(self.settings, "GITHUB_TOKEN", None)
        if not github_token:
            # Jenkins credentials ID를 사용하여 token 가져오기 시도
            # 실제로는 Jenkins credentials API를 통해 가져와야 하지만,
            # 여기서는 환경 변수에서 직접 가져오는 방식 사용
            raise ValueError("GITHUB_TOKEN environment variable is required for auto-registering webhooks")
        
        # Repository owner와 name 추출
        owner, repo = self._extract_github_repo_info(git_url)
        
        print(f"[DEBUG] Creating webhook for: owner={owner}, repo={repo}")
        
        # GitHub API로 webhook 생성
        api_url = f"https://api.github.com/repos/{owner}/{repo}/hooks"
        print(f"[DEBUG] GitHub API URL: {api_url}")
        headers = {
            "Authorization": f"token {github_token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        }
        
        payload = {
            "name": "web",
            "active": True,
            "events": ["push"],
            "config": {
                "url": webhook_url,
                "content_type": "json",
                "insecure_ssl": "0"  # SSL 검증 활성화
            }
        }
        
        # Webhook secret이 있으면 추가
        if webhook_secret:
            payload["config"]["secret"] = webhook_secret
        
        response = requests.post(api_url, json=payload, headers=headers, timeout=10)
        
        print(f"[DEBUG] GitHub API response: status={response.status_code}")
        if response.status_code != 201:
            print(f"[DEBUG] GitHub API error response: {response.text}")
        
        if response.status_code == 201:
            webhook_data = response.json()
            return str(webhook_data.get("id"))
        elif response.status_code == 422:
            # Webhook이 이미 존재하는 경우
            error_data = response.json()
            if "already exists" in str(error_data.get("message", "")).lower():
                # 기존 webhook 찾기
                existing_hooks = requests.get(api_url, headers=headers, timeout=10)
                if existing_hooks.status_code == 200:
                    hooks = existing_hooks.json()
                    for hook in hooks:
                        if hook.get("config", {}).get("url") == webhook_url:
                            return str(hook.get("id"))
            raise RuntimeError(f"GitHub webhook registration failed: {error_data}")
        else:
            raise RuntimeError(f"GitHub API error: {response.status_code} {response.text}")

    def _build_web_pipeline_xml_with_readfile(self) -> str:
        """
        Build Jenkins pipeline XML for web trigger mode using inline script.
        Jenkinsfile을 직접 읽어서 인라인으로 삽입합니다 (Script Security 회피).
        """
        from pathlib import Path
        
        # Jenkinsfile 경로 찾기
        jenkinsfile_path = None
        searched_paths = []
        
        # 1. /app/Jenkinsfile (백엔드 컨테이너에 마운트된 파일)
        jenkinsfile_path = Path("/app/Jenkinsfile")
        searched_paths.append(str(jenkinsfile_path))
        if not jenkinsfile_path.exists():
            # 2. /jenkins_home/Jenkinsfile (백엔드 컨테이너에서 마운트된 볼륨)
            jenkinsfile_path = Path("/jenkins_home/Jenkinsfile")
            searched_paths.append(str(jenkinsfile_path))
            if not jenkinsfile_path.exists() or jenkinsfile_path.stat().st_size == 0:
                # 3. 프로젝트 루트의 jenkins/Jenkinsfile
                current_file = Path(__file__).resolve()
                project_root = current_file.parent.parent.parent.parent
                jenkinsfile_path = project_root / "jenkins" / "Jenkinsfile"
                searched_paths.append(str(jenkinsfile_path))
                if not jenkinsfile_path.exists():
                    # 4. 현재 작업 디렉토리 기준
                    cwd = Path(os.getcwd())
                    jenkinsfile_path = cwd / "jenkins" / "Jenkinsfile"
                    searched_paths.append(str(jenkinsfile_path))
                    if not jenkinsfile_path.exists():
                        jenkinsfile_path = cwd / "Jenkinsfile"
                        searched_paths.append(str(jenkinsfile_path))
        
        if not jenkinsfile_path or not jenkinsfile_path.exists():
            raise FileNotFoundError(
                f"Jenkinsfile not found. Searched paths:\n" +
                "\n".join(f"  - {p}" for p in searched_paths)
            )
        
        # Jenkinsfile 내용 읽기
        print(f"[DEBUG] Reading Jenkinsfile from: {jenkinsfile_path}")
        with open(jenkinsfile_path, 'r', encoding='utf-8') as f:
            pipeline_script = f.read()
        
        if not pipeline_script or len(pipeline_script.strip()) == 0:
            raise ValueError(f"Jenkinsfile is empty at {jenkinsfile_path}")
        
        print(f"[DEBUG] Jenkinsfile read successfully: {len(pipeline_script)} bytes")
        
        # XML 특수 문자 이스케이프
        pipeline_script_escaped = (
            pipeline_script
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&apos;')
        )
        
        # 파라미터 정의 XML (Web 모드용)
        parameters_xml = """    <hudson.model.ParametersDefinitionProperty>
      <parameterDefinitions>
        <hudson.model.ChoiceParameterDefinition>
          <name>SOURCE_TYPE</name>
          <description>git=Git Repository (기본값), upload=ZIP File Upload</description>
          <choices class="java.util.Arrays$ArrayList">
            <a class="string-array">
              <string>git</string>
              <string>upload</string>
            </a>
          </choices>
        </hudson.model.ChoiceParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>GITHUB_URL</name>
          <description>분석할 GitHub 저장소 URL (SOURCE_TYPE=git일 때 사용)</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>UPLOADED_FILE_PATH</name>
          <description>업로드된 ZIP 파일 경로 (SOURCE_TYPE=upload일 때 사용)</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>PROJECT_NAME</name>
          <description>프로젝트 이름 (SOURCE_TYPE=upload일 때 사용)</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.ChoiceParameterDefinition>
          <name>SCAN_TYPE</name>
          <description>스캔 타입</description>
          <choices class="java.util.Arrays$ArrayList">
            <a class="string-array">
              <string>ALL</string>
              <string>SSRF</string>
              <string>RCE</string>
              <string>XSS</string>
              <string>SQLi</string>
              <string>IDOR</string>
              <string>PATH_TRAVERSAL</string>
              <string>AUTH</string>
            </a>
          </choices>
        </hudson.model.ChoiceParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>API_PROVIDER</name>
          <description>LLM API 제공자 (예: groq, openai, azure-openai 등)</description>
          <defaultValue>groq</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>MODEL</name>
          <description>LLM 모델 식별자 (예: gpt-4o, llama-3.3-70b-versatile 등)</description>
          <defaultValue>gpt-4o</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>LLM_ENDPOINT_URL</name>
          <description>옵션: 커스텀 LLM 엔드포인트 URL</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>LLM_API_KEY</name>
          <description>옵션: 커스텀 LLM API Key/Token</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.BooleanParameterDefinition>
          <name>RUN_SAST</name>
          <description>Semgrep SAST 실행 여부</description>
          <defaultValue>true</defaultValue>
        </hudson.model.BooleanParameterDefinition>
        <hudson.model.ChoiceParameterDefinition>
          <name>SCAN_MODE</name>
          <description>custom=Full Scan (기본값), preset=Quick Scan</description>
          <choices class="java.util.Arrays$ArrayList">
            <a class="string-array">
              <string>custom</string>
              <string>preset</string>
            </a>
          </choices>
        </hudson.model.ChoiceParameterDefinition>
        <hudson.model.ChoiceParameterDefinition>
          <name>PROFILE_MODE</name>
          <description>각 스캔 타입 내에서 preset (기본 설정, 기본값) or custom (고급 설정)</description>
          <choices class="java.util.Arrays$ArrayList">
            <a class="string-array">
              <string>preset</string>
              <string>custom</string>
            </a>
          </choices>
        </hudson.model.ChoiceParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>PROJECT_ID</name>
          <description>L2VE 백엔드 project_id</description>
          <defaultValue>1</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>SCAN_ID</name>
          <description>L2VE 백엔드 scan_id</description>
          <defaultValue>0</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.ChoiceParameterDefinition>
          <name>TRIGGER_MODE</name>
          <description>web=웹 UI 수동 스캔, git=Git webhook 자동 스캔</description>
          <choices class="java.util.Arrays$ArrayList">
            <a class="string-array">
              <string>web</string>
              <string>git</string>
            </a>
          </choices>
        </hudson.model.ChoiceParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>API_BASE</name>
          <description>L2VE 백엔드 API Base</description>
          <defaultValue>http://backend:3000/api</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>BACKEND_SERVICE_API_KEY</name>
          <description>백엔드 고정 API Key</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>JENKINS_CALLBACK_SECRET</name>
          <description>백엔드 콜백 시크릿</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>NOTIFY_EMAILS</name>
          <description>스캔 완료/실패 알림 수신자 (콤마 구분)</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
      </parameterDefinitions>
    </hudson.model.ParametersDefinitionProperty>"""
        
        return f"""<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <description>Auto-generated pipeline for L2VE project (Web Trigger - Local Jenkinsfile)</description>
  <keepDependencies>false</keepDependencies>
  <properties>
    <hudson.model.BuildDiscarderProperty>
      <strategy class="hudson.tasks.LogRotator">
        <daysToKeep>-1</daysToKeep>
        <numToKeep>10</numToKeep>
        <artifactDaysToKeep>-1</artifactDaysToKeep>
        <artifactNumToKeep>10</artifactNumToKeep>
      </strategy>
    </hudson.model.BuildDiscarderProperty>
    <org.jenkinsci.plugins.workflow.job.properties.DisableConcurrentBuildsJobProperty>
      <specification></specification>
    </org.jenkinsci.plugins.workflow.job.properties.DisableConcurrentBuildsJobProperty>
{parameters_xml}
  </properties>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition" plugin="workflow-cps">
    <script>{pipeline_script_escaped}</script>
    <sandbox>true</sandbox>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>
"""

    def _build_web_pipeline_xml(self, jenkinsfile_git_url: Optional[str] = None, jenkinsfile_branch: str = "main") -> str:
        """
        Build Jenkins pipeline XML for web trigger mode.
        
        If jenkinsfile_git_url is provided, uses SCM mode (avoids Script Security).
        Otherwise, falls back to inline script mode (requires Script Security approval).
        
        Args:
            jenkinsfile_git_url: Optional Git URL for Jenkinsfile repository (or file:// URL for local path)
            jenkinsfile_branch: Branch name for Jenkinsfile (default: main)
        """
        from pathlib import Path
        
        # SCM 모드 사용 가능한 경우 (Script Security 회피)
        if jenkinsfile_git_url:
            print(f"[DEBUG] Building SCM mode pipeline with URL: {jenkinsfile_git_url}, branch: {jenkinsfile_branch}")
            return self._build_web_pipeline_xml_scm(jenkinsfile_git_url, jenkinsfile_branch)
        
        # 인라인 스크립트 모드 (Script Security 필요)
        print(f"[WARNING] Building inline script mode pipeline (requires Script Security approval)")
        return self._build_web_pipeline_xml_inline()
    
    def _build_web_pipeline_xml_scm(self, jenkinsfile_git_url: str, jenkinsfile_branch: str) -> str:
        """
        Build Jenkins pipeline XML for web trigger mode using SCM (avoids Script Security).
        Jenkinsfile을 Git 저장소 또는 로컬 파일 시스템(file://)에서 읽어옵니다.
        """
        branch_spec = jenkinsfile_branch if jenkinsfile_branch.startswith("*/") else f"*/{jenkinsfile_branch}"
        script_path = "Jenkinsfile"
        
        # 로컬 파일 시스템 경로인 경우 (file://) credentials 불필요
        is_local_path = jenkinsfile_git_url.startswith("file://")
        
        # Jenkins Git credentials ID 가져오기 (로컬 경로가 아닌 경우만)
        if is_local_path:
            credentials_id = None
            github_project_url_xml = ""
        else:
            # 환경 변수에서 직접 가져오기 (설정 우선순위)
            credentials_id = os.getenv("JENKINS_GIT_CREDENTIALS_ID") or getattr(self.settings, "JENKINS_GIT_CREDENTIALS_ID", None) or "github-token"
            # 빈 문자열이면 기본값 사용
            if not credentials_id or credentials_id.strip() == "":
                credentials_id = "github-token"
            
            # GitHub 프로젝트 URL 생성 (GitHub 저장소인 경우만)
            if 'github.com' in jenkinsfile_git_url:
                github_project_url = jenkinsfile_git_url.rstrip('/')
                if github_project_url.endswith('.git'):
                    github_project_url = github_project_url[:-4]
                if github_project_url.startswith('git@'):
                    github_project_url = github_project_url.replace('git@github.com:', 'https://github.com/')
                elif not github_project_url.startswith('http'):
                    github_project_url = f"https://github.com/{github_project_url}"
                github_project_url_xml = f"""    <com.coravy.hudson.plugins.github.GithubProjectProperty plugin="github@1.37.3">
      <projectUrl>{github_project_url}</projectUrl>
    </com.coravy.hudson.plugins.github.GithubProjectProperty>"""
            else:
                github_project_url_xml = ""
        
        print(f"[DEBUG] Using Git credentials ID: {credentials_id}")
        credentials_xml = f'<credentialsId>{credentials_id}</credentialsId>' if credentials_id else ''
        
        # 파라미터 정의 XML 생성 (Jenkinsfile의 parameters 블록과 동일하게)
        # SCM 방식에서도 파라미터를 제대로 전달받으려면 job XML에 파라미터 정의 필요
        parameters_xml = """    <hudson.model.ParametersDefinitionProperty>
      <parameterDefinitions>
        <hudson.model.ChoiceParameterDefinition>
          <name>SOURCE_TYPE</name>
          <description>git=Git Repository (기본값), upload=ZIP File Upload</description>
          <choices class="java.util.Arrays$ArrayList">
            <a class="string-array">
              <string>git</string>
              <string>upload</string>
            </a>
          </choices>
        </hudson.model.ChoiceParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>GITHUB_URL</name>
          <description>분석할 GitHub 저장소 URL (SOURCE_TYPE=git일 때 사용)</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>UPLOADED_FILE_PATH</name>
          <description>업로드된 ZIP 파일 경로 (SOURCE_TYPE=upload일 때 사용)</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>PROJECT_NAME</name>
          <description>프로젝트 이름 (SOURCE_TYPE=upload일 때 사용)</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.ChoiceParameterDefinition>
          <name>SCAN_TYPE</name>
          <description>스캔 타입</description>
          <choices class="java.util.Arrays$ArrayList">
            <a class="string-array">
              <string>ALL</string>
              <string>SSRF</string>
              <string>RCE</string>
              <string>XSS</string>
              <string>SQLi</string>
              <string>IDOR</string>
              <string>PATH_TRAVERSAL</string>
              <string>AUTH</string>
            </a>
          </choices>
        </hudson.model.ChoiceParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>API_PROVIDER</name>
          <description>LLM API 제공자 (예: groq, openai, azure-openai 등)</description>
          <defaultValue>groq</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>MODEL</name>
          <description>LLM 모델 식별자 (예: gpt-4o, llama-3.3-70b-versatile 등)</description>
          <defaultValue>gpt-4o</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>LLM_ENDPOINT_URL</name>
          <description>옵션: 커스텀 LLM 엔드포인트 URL</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>LLM_API_KEY</name>
          <description>옵션: 커스텀 LLM API Key/Token</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.BooleanParameterDefinition>
          <name>RUN_SAST</name>
          <description>Semgrep SAST 실행 여부</description>
          <defaultValue>true</defaultValue>
        </hudson.model.BooleanParameterDefinition>
        <hudson.model.ChoiceParameterDefinition>
          <name>SCAN_MODE</name>
          <description>custom=Full Scan (기본값), preset=Quick Scan</description>
          <choices class="java.util.Arrays$ArrayList">
            <a class="string-array">
              <string>custom</string>
              <string>preset</string>
            </a>
          </choices>
        </hudson.model.ChoiceParameterDefinition>
        <hudson.model.ChoiceParameterDefinition>
          <name>PROFILE_MODE</name>
          <description>각 스캔 타입 내에서 preset (기본 설정, 기본값) or custom (고급 설정)</description>
          <choices class="java.util.Arrays$ArrayList">
            <a class="string-array">
              <string>preset</string>
              <string>custom</string>
            </a>
          </choices>
        </hudson.model.ChoiceParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>PROJECT_ID</name>
          <description>L2VE 백엔드 project_id</description>
          <defaultValue>1</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>SCAN_ID</name>
          <description>L2VE 백엔드 scan_id</description>
          <defaultValue>0</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.ChoiceParameterDefinition>
          <name>TRIGGER_MODE</name>
          <description>web=웹 UI 수동 스캔, git=Git webhook 자동 스캔</description>
          <choices class="java.util.Arrays$ArrayList">
            <a class="string-array">
              <string>web</string>
              <string>git</string>
            </a>
          </choices>
        </hudson.model.ChoiceParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>API_BASE</name>
          <description>L2VE 백엔드 API Base</description>
          <defaultValue>http://113.198.66.77:13196/api</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>BACKEND_SERVICE_API_KEY</name>
          <description>백엔드 고정 API Key</description>
          <defaultValue>0a0d8158a4cdf85795e9de89891991da9805c881f3a910fd25c94ad20b8880f5</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>JENKINS_CALLBACK_SECRET</name>
          <description>백엔드 콜백 시크릿</description>
          <defaultValue>c707604ba68ef24a04d0eb74b247a3a234cfc9780b6c67790fdd5f58ef8d7add</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>DB_DSN</name>
          <description>PostgreSQL DSN for seed_db (format: postgresql://user:password@host:port/dbname)</description>
          <defaultValue>postgresql://admin:password@113.198.66.75:18252/postdb</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>NOTIFY_EMAILS</name>
          <description>스캔 완료/실패 알림 수신자 (콤마 구분)</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
      </parameterDefinitions>
    </hudson.model.ParametersDefinitionProperty>"""
        
        return f"""<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <description>Auto-generated pipeline for L2VE project (Web Trigger - SCM Mode)</description>
  <keepDependencies>false</keepDependencies>
  <properties>
    <hudson.model.BuildDiscarderProperty>
      <strategy class="hudson.tasks.LogRotator">
        <daysToKeep>-1</daysToKeep>
        <numToKeep>10</numToKeep>
        <artifactDaysToKeep>-1</artifactDaysToKeep>
        <artifactNumToKeep>10</artifactNumToKeep>
      </strategy>
    </hudson.model.BuildDiscarderProperty>
    <org.jenkinsci.plugins.workflow.job.properties.DisableConcurrentBuildsJobProperty>
      <specification></specification>
    </org.jenkinsci.plugins.workflow.job.properties.DisableConcurrentBuildsJobProperty>
{github_project_url_xml}
{parameters_xml}
  </properties>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps">
    <scm class="hudson.plugins.git.GitSCM" plugin="git">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>{jenkinsfile_git_url}</url>
          {credentials_xml}
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>{branch_spec}</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
      <doGenerateSubmoduleConfigurations>false</doGenerateSubmoduleConfigurations>
      <submoduleCfg class="list"/>
      <extensions/>
    </scm>
    <scriptPath>{script_path}</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>
"""
    
    def _build_web_pipeline_xml_from_local_path(self, local_path: str) -> str:
        """
        Build Jenkins pipeline XML for web trigger mode by reading Jenkinsfile from local path.
        백엔드 컨테이너에서 접근 가능한 경로에서 Jenkinsfile을 읽어서 인라인 스크립트로 삽입합니다.
        
        ⚠️ 이 방식은 Script Security 승인이 필요합니다.
        하지만 로컬 파일을 직접 읽어오므로 Git 저장소가 필요 없습니다.
        
        Args:
            local_path: Jenkins 서버의 로컬 경로 (예: /home/ubuntu/jg/L2VE)
                       또는 백엔드 컨테이너에서 접근 가능한 경로
        """
        from pathlib import Path
        
        # 백엔드 컨테이너에서 접근 가능한 경로 우선 시도
        # 1. /app/Jenkinsfile (docker-compose.yml에서 마운트됨)
        jenkinsfile_path = Path("/app/Jenkinsfile")
        
        # 2. JENKINSFILE_PATH 환경 변수
        if not jenkinsfile_path.exists():
            env_jenkinsfile_path = getattr(self.settings, "JENKINSFILE_PATH", None) or os.getenv("JENKINSFILE_PATH")
            if env_jenkinsfile_path:
                jenkinsfile_path = Path(env_jenkinsfile_path)
        
        # 3. local_path/Jenkinsfile (백엔드 컨테이너에서 접근 가능한 경우)
        if not jenkinsfile_path.exists():
            test_path = Path(local_path) / "Jenkinsfile"
            if test_path.exists():
                jenkinsfile_path = test_path
        
        # 4. __file__ 기준으로 프로젝트 루트 찾기
        if not jenkinsfile_path.exists():
            current_file = Path(__file__).resolve()
            project_root = current_file.parent.parent.parent.parent
            jenkinsfile_path = project_root / "Jenkinsfile"
        
        # 최종 확인
        if not jenkinsfile_path.exists():
            raise FileNotFoundError(
                f"Jenkinsfile not found. Tried paths:\n"
                f"  - /app/Jenkinsfile\n"
                f"  - {Path(local_path) / 'Jenkinsfile'}\n"
                f"  - {Path(__file__).resolve().parent.parent.parent.parent / 'Jenkinsfile'}\n"
                f"  - JENKINSFILE_PATH env: {os.getenv('JENKINSFILE_PATH', 'not set')}\n\n"
                f"Note: JENKINSFILE_LOCAL_PATH ({local_path}) is the path on Jenkins server, "
                f"but backend needs to read from a path accessible in the Docker container.\n"
                f"Please ensure Jenkinsfile is accessible at one of the paths above, "
                f"or set JENKINSFILE_PATH to point to the Jenkinsfile location."
            )
        
        # Jenkinsfile 내용 읽기
        with open(jenkinsfile_path, 'r', encoding='utf-8') as f:
            pipeline_script = f.read()
        
        print(f"[DEBUG] Successfully read Jenkinsfile from: {jenkinsfile_path}")
        print(f"[DEBUG] Jenkinsfile size: {len(pipeline_script)} characters")
        
        # 인라인 스크립트 모드로 빌드
        return self._build_web_pipeline_xml_inline_with_script(pipeline_script)
    
    def _build_web_pipeline_xml_inline_with_script(self, pipeline_script: str) -> str:
        """
        Build Jenkins pipeline XML with provided script content.
        
        Args:
            pipeline_script: Jenkinsfile script content
        """
        # XML 특수 문자 이스케이프
        pipeline_script_escaped = (
            pipeline_script
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&apos;')
        )
        
        return f"""<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <description>Auto-generated pipeline for L2VE project (Web Trigger - Inline Script from Local Path)</description>
  <keepDependencies>false</keepDependencies>
  <properties>
    <hudson.model.BuildDiscarderProperty>
      <strategy class="hudson.tasks.LogRotator">
        <daysToKeep>-1</daysToKeep>
        <numToKeep>10</numToKeep>
        <artifactDaysToKeep>-1</artifactDaysToKeep>
        <artifactNumToKeep>10</artifactNumToKeep>
      </strategy>
    </hudson.model.BuildDiscarderProperty>
    <org.jenkinsci.plugins.workflow.job.properties.DisableConcurrentBuildsJobProperty>
      <specification></specification>
    </org.jenkinsci.plugins.workflow.job.properties.DisableConcurrentBuildsJobProperty>
  </properties>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition" plugin="workflow-cps">
    <script>{pipeline_script_escaped}</script>
    <sandbox>true</sandbox>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>
"""
    
    def _build_web_pipeline_xml_inline(self) -> str:
        """
        Build Jenkins pipeline XML for web trigger mode using inline script.
        ⚠️ 이 방식은 Script Security 승인이 필요합니다.
        """
        from pathlib import Path
        
        # Jenkinsfile 경로 찾기 (여러 경로 시도)
        jenkinsfile_path = None
        current_file = None
        
        # 1. 설정에서 직접 경로 지정 (최우선)
        if hasattr(self.settings, 'JENKINSFILE_PATH') and self.settings.JENKINSFILE_PATH:
            jenkinsfile_path = Path(self.settings.JENKINSFILE_PATH)
            if not jenkinsfile_path.exists():
                jenkinsfile_path = None
        
        # 2. 환경 변수에서 직접 경로 지정
        if not jenkinsfile_path or not jenkinsfile_path.exists():
            env_jenkinsfile_path = os.getenv("JENKINSFILE_PATH")
            if env_jenkinsfile_path:
                jenkinsfile_path = Path(env_jenkinsfile_path)
                if not jenkinsfile_path.exists():
                    jenkinsfile_path = None
        
        # 3. 설정에서 프로젝트 루트 지정
        if not jenkinsfile_path or not jenkinsfile_path.exists():
            project_root_setting = getattr(self.settings, 'PROJECT_ROOT', None)
            if project_root_setting:
                jenkinsfile_path = Path(project_root_setting) / "Jenkinsfile"
                if not jenkinsfile_path.exists():
                    jenkinsfile_path = None
        
        # 4. 환경 변수에서 프로젝트 루트 지정
        if not jenkinsfile_path or not jenkinsfile_path.exists():
            project_root_env = os.getenv("PROJECT_ROOT")
            if project_root_env:
                jenkinsfile_path = Path(project_root_env) / "Jenkinsfile"
                if not jenkinsfile_path.exists():
                    jenkinsfile_path = None
        
        # 5. __file__ 기준으로 프로젝트 루트 찾기
        if not jenkinsfile_path or not jenkinsfile_path.exists():
            current_file = Path(__file__).resolve()
            # backend/app/services/jenkins_job_service.py -> backend -> 프로젝트 루트
            project_root = current_file.parent.parent.parent.parent
            jenkinsfile_path = project_root / "Jenkinsfile"
            if not jenkinsfile_path.exists():
                jenkinsfile_path = None
        
        # 6. 현재 작업 디렉토리 기준
        if not jenkinsfile_path or not jenkinsfile_path.exists():
            cwd = Path(os.getcwd())
            jenkinsfile_path = cwd / "Jenkinsfile"
            if not jenkinsfile_path.exists():
                # 상위 디렉토리도 확인
                jenkinsfile_path = cwd.parent / "Jenkinsfile"
                if not jenkinsfile_path.exists():
                    jenkinsfile_path = None
        
        # 7. /app/Jenkinsfile (Docker 컨테이너 내부 경로)
        if not jenkinsfile_path or not jenkinsfile_path.exists():
            docker_path = Path("/app/Jenkinsfile")
            if docker_path.exists():
                jenkinsfile_path = docker_path
        
        # 최종 확인
        if not jenkinsfile_path or not jenkinsfile_path.exists():
            searched_paths = []
            if hasattr(self.settings, 'JENKINSFILE_PATH') and self.settings.JENKINSFILE_PATH:
                searched_paths.append(f"Settings.JENKINSFILE_PATH: {self.settings.JENKINSFILE_PATH}")
            if os.getenv("JENKINSFILE_PATH"):
                searched_paths.append(f"JENKINSFILE_PATH env: {os.getenv('JENKINSFILE_PATH')}")
            if getattr(self.settings, 'PROJECT_ROOT', None):
                searched_paths.append(f"Settings.PROJECT_ROOT/Jenkinsfile: {Path(self.settings.PROJECT_ROOT) / 'Jenkinsfile'}")
            if os.getenv("PROJECT_ROOT"):
                searched_paths.append(f"PROJECT_ROOT env/Jenkinsfile: {Path(os.getenv('PROJECT_ROOT')) / 'Jenkinsfile'}")
            if current_file:
                searched_paths.append(f"__file__ based: {current_file.parent.parent.parent.parent / 'Jenkinsfile'}")
            searched_paths.append(f"cwd: {Path(os.getcwd()) / 'Jenkinsfile'}")
            searched_paths.append("/app/Jenkinsfile")
            
            raise FileNotFoundError(
                f"Jenkinsfile not found. Searched paths:\n" + 
                "\n".join(f"  - {p}" for p in searched_paths) +
                "\n\nPlease set JENKINSFILE_PATH environment variable to the absolute path of Jenkinsfile, "
                "or mount the project root directory to /app in Docker."
            )
        
        # Jenkinsfile 내용 읽기
        with open(jenkinsfile_path, 'r', encoding='utf-8') as f:
            pipeline_script = f.read()
        
        # XML 특수 문자 이스케이프 (CDATA 섹션 사용이 더 안전)
        # 하지만 Jenkins는 CDATA를 지원하지 않으므로 이스케이프 필요
        pipeline_script_escaped = (
            pipeline_script
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&apos;')
        )
        
        return f"""<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <description>Auto-generated pipeline for L2VE project (Web Trigger)</description>
  <keepDependencies>false</keepDependencies>
  <properties>
    <hudson.model.BuildDiscarderProperty>
      <strategy class="hudson.tasks.LogRotator">
        <daysToKeep>-1</daysToKeep>
        <numToKeep>10</numToKeep>
        <artifactDaysToKeep>-1</artifactDaysToKeep>
        <artifactNumToKeep>10</artifactNumToKeep>
      </strategy>
    </hudson.model.BuildDiscarderProperty>
    <org.jenkinsci.plugins.workflow.job.properties.DisableConcurrentBuildsJobProperty>
      <specification></specification>
    </org.jenkinsci.plugins.workflow.job.properties.DisableConcurrentBuildsJobProperty>
  </properties>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition" plugin="workflow-cps">
    <script>{pipeline_script_escaped}</script>
    <sandbox>true</sandbox>
  </definition>
  <properties>
    <org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
      <triggers/>
    </org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
  </properties>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>
"""

    def _build_git_pipeline_xml(self, git_url: str, git_branch: str) -> str:
        branch_spec = git_branch if git_branch.startswith("*/") else f"*/{git_branch}"
        script_path = self.default_script_path or "Jenkinsfile"
        
        # Jenkins Git credentials ID 가져오기 (환경 변수에서)
        # Jenkinsfile에서 사용하는 credentials ID와 동일하게 설정
        # 기본값: 'github-token' (Jenkinsfile의 credentials('github-token')와 일치)
        credentials_id = os.getenv("JENKINS_GIT_CREDENTIALS_ID") or getattr(self.settings, "JENKINS_GIT_CREDENTIALS_ID", None) or "github-token"
        # 빈 문자열이면 기본값 사용
        if not credentials_id or credentials_id.strip() == "":
            credentials_id = "github-token"
        
        print(f"[DEBUG] Using Git credentials ID: {credentials_id}")
        # credentialsId가 있으면 추가, 없으면 생략 (public repo의 경우)
        credentials_xml = f'<credentialsId>{credentials_id}</credentialsId>' if credentials_id else ''
        
        # GitHub 프로젝트 URL 추출 (https://github.com/org/repo 형식)
        # .git 제거하고 GitHub 프로젝트 URL 생성
        github_project_url = git_url.rstrip('/')
        if github_project_url.endswith('.git'):
            github_project_url = github_project_url[:-4]
        if not github_project_url.startswith('http'):
            # SSH 형식인 경우 변환 (git@github.com:org/repo.git -> https://github.com/org/repo)
            if github_project_url.startswith('git@'):
                github_project_url = github_project_url.replace('git@github.com:', 'https://github.com/')
            else:
                github_project_url = f"https://github.com/{github_project_url}"
        
        # 파라미터 정의 XML 생성 (Web trigger mode와 동일)
        # Git push로 트리거될 때는 파라미터 없이 실행되지만,
        # Jenkinsfile의 parameters {} 블록이 첫 빌드 후에만 적용되므로
        # Job XML에 파라미터를 정의하여 첫 빌드부터 정상 작동하도록 함
        parameters_xml = """    <hudson.model.ParametersDefinitionProperty>
      <parameterDefinitions>
        <hudson.model.ChoiceParameterDefinition>
          <name>SOURCE_TYPE</name>
          <description>git=Git Repository (기본값), upload=ZIP File Upload</description>
          <choices class="java.util.Arrays$ArrayList">
            <a class="string-array">
              <string>git</string>
              <string>upload</string>
            </a>
          </choices>
        </hudson.model.ChoiceParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>GITHUB_URL</name>
          <description>분석할 GitHub 저장소 URL (Git push 트리거 시 자동 감지)</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>UPLOADED_FILE_PATH</name>
          <description>업로드된 ZIP 파일 경로</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>PROJECT_NAME</name>
          <description>프로젝트 이름</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.ChoiceParameterDefinition>
          <name>SCAN_TYPE</name>
          <description>스캔 타입</description>
          <choices class="java.util.Arrays$ArrayList">
            <a class="string-array">
              <string>ALL</string>
              <string>SSRF</string>
              <string>RCE</string>
              <string>XSS</string>
              <string>SQLi</string>
              <string>IDOR</string>
              <string>PATH_TRAVERSAL</string>
              <string>AUTH</string>
            </a>
          </choices>
        </hudson.model.ChoiceParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>API_PROVIDER</name>
          <description>LLM API 제공자 (예: groq, openai, azure-openai 등)</description>
          <defaultValue>groq</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>MODEL</name>
          <description>LLM 모델 식별자 (예: gpt-4o, llama-3.3-70b-versatile 등)</description>
          <defaultValue>gpt-4o</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>LLM_ENDPOINT_URL</name>
          <description>옵션: 커스텀 LLM 엔드포인트 URL</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>LLM_API_KEY</name>
          <description>옵션: 커스텀 LLM API Key/Token</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.BooleanParameterDefinition>
          <name>RUN_SAST</name>
          <description>Semgrep SAST 실행 여부</description>
          <defaultValue>true</defaultValue>
        </hudson.model.BooleanParameterDefinition>
        <hudson.model.ChoiceParameterDefinition>
          <name>SCAN_MODE</name>
          <description>custom=Full Scan (기본값), preset=Quick Scan</description>
          <choices class="java.util.Arrays$ArrayList">
            <a class="string-array">
              <string>custom</string>
              <string>preset</string>
            </a>
          </choices>
        </hudson.model.ChoiceParameterDefinition>
        <hudson.model.ChoiceParameterDefinition>
          <name>PROFILE_MODE</name>
          <description>각 스캔 타입 내에서 preset (기본 설정, 기본값) or custom (고급 설정)</description>
          <choices class="java.util.Arrays$ArrayList">
            <a class="string-array">
              <string>preset</string>
              <string>custom</string>
            </a>
          </choices>
        </hudson.model.ChoiceParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>PROJECT_ID</name>
          <description>L2VE 백엔드 project_id</description>
          <defaultValue>1</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>SCAN_ID</name>
          <description>L2VE 백엔드 scan_id (Git push 트리거 시 Auto-Scan Setup에서 자동 생성)</description>
          <defaultValue>0</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.ChoiceParameterDefinition>
          <name>TRIGGER_MODE</name>
          <description>git=Git webhook 자동 스캔 (기본값), web=웹 UI 수동 스캔</description>
          <choices class="java.util.Arrays$ArrayList">
            <a class="string-array">
              <string>git</string>
              <string>web</string>
            </a>
          </choices>
        </hudson.model.ChoiceParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>API_BASE</name>
          <description>L2VE 백엔드 API Base</description>
          <defaultValue>http://113.198.66.77:13196/api</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>BACKEND_SERVICE_API_KEY</name>
          <description>백엔드 고정 API Key</description>
          <defaultValue>0a0d8158a4cdf85795e9de89891991da9805c881f3a910fd25c94ad20b8880f5</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>JENKINS_CALLBACK_SECRET</name>
          <description>백엔드 콜백 시크릿</description>
          <defaultValue>c707604ba68ef24a04d0eb74b247a3a234cfc9780b6c67790fdd5f58ef8d7add</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>DB_DSN</name>
          <description>PostgreSQL DSN for seed_db</description>
          <defaultValue>postgresql://admin:password@113.198.66.75:18252/postdb</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>NOTIFY_EMAILS</name>
          <description>스캔 완료/실패 알림 수신자 (콤마 구분)</description>
          <defaultValue></defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
      </parameterDefinitions>
    </hudson.model.ParametersDefinitionProperty>"""

        return f"""<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <description>Auto-generated pipeline for L2VE project (Git Trigger Mode)</description>
  <keepDependencies>false</keepDependencies>
  <properties>
    <hudson.model.BuildDiscarderProperty>
      <strategy class="hudson.tasks.LogRotator">
        <daysToKeep>-1</daysToKeep>
        <numToKeep>10</numToKeep>
        <artifactDaysToKeep>-1</artifactDaysToKeep>
        <artifactNumToKeep>10</artifactNumToKeep>
      </strategy>
    </hudson.model.BuildDiscarderProperty>
    <com.coravy.hudson.plugins.github.GithubProjectProperty plugin="github@1.37.3">
      <projectUrl>{github_project_url}</projectUrl>
      <displayName></displayName>
    </com.coravy.hudson.plugins.github.GithubProjectProperty>
    <org.jenkinsci.plugins.workflow.job.properties.DisableConcurrentBuildsJobProperty>
      <specification></specification>
    </org.jenkinsci.plugins.workflow.job.properties.DisableConcurrentBuildsJobProperty>
{parameters_xml}
  </properties>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps">
    <scm class="hudson.plugins.git.GitSCM" plugin="git">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>{git_url}</url>
          {credentials_xml}
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>{branch_spec}</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
      <doGenerateSubmoduleConfigurations>false</doGenerateSubmoduleConfigurations>
      <submoduleCfg class="list"/>
      <extensions/>
    </scm>
    <scriptPath>{script_path}</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers>
    <com.cloudbees.jenkins.GitHubPushTrigger plugin="github@1.37.3">
      <spec></spec>
    </com.cloudbees.jenkins.GitHubPushTrigger>
  </triggers>
  <disabled>false</disabled>
</flow-definition>
"""

    # def _approve_jenkinsfile_script(self) -> None:
    #     """
    #     Jenkinsfile 스크립트를 Jenkins Script Security에 미리 승인합니다.
    #     """
    #     from pathlib import Path
        
    #     # Jenkinsfile 경로 찾기
    #     jenkinsfile_path = Path("/app/Jenkinsfile")
    #     if not jenkinsfile_path.exists():
    #         jenkinsfile_path = Path("/jenkins_home/Jenkinsfile")
    #         if not jenkinsfile_path.exists() or jenkinsfile_path.stat().st_size == 0:
    #             return  # 파일이 없으면 스킵
        
    #     # Jenkinsfile 내용 읽기
    #     with open(jenkinsfile_path, 'r', encoding='utf-8') as f:
    #         pipeline_script = f.read()
        
    #     if not pipeline_script or len(pipeline_script.strip()) == 0:
    #         return
        
    #     # Jenkins Script Security API를 통해 스크립트 승인
    #     try:
    #         # Script Approval API 엔드포인트
    #         approval_url = f"{self.client.base_url}/scriptApproval/approveScript"
            
    #         # 스크립트 해시 계산 (Jenkins가 사용하는 방식)
    #         import hashlib
    #         script_hash = hashlib.sha256(pipeline_script.encode('utf-8')).hexdigest()
            
    #         # 승인 요청
    #         response = self.client.session.post(
    #             approval_url,
    #             data={'script': pipeline_script},
    #             timeout=10
    #         )
            
    #         if response.status_code in (200, 201):
    #             print(f"[DEBUG] Jenkinsfile script pre-approved (hash: {script_hash[:16]}...)")
    #         else:
    #             print(f"[DEBUG] Failed to pre-approve script: {response.status_code} {response.text}")
    #     except Exception as e:
    #         print(f"[DEBUG] Could not pre-approve script via API: {e}")
    #         # API 승인이 실패해도 계속 진행 (초기화 스크립트가 처리할 수 있음)
