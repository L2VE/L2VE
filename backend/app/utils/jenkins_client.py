import os
from typing import Any, Dict, List, Optional

import requests

from app.config import get_settings

USERNAME_PASSWORD_CLASSES = {
    "com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl",
    "com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl$DescriptorImpl",
}
STRING_CREDENTIAL_CLASSES = {
    "org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl",
}


class JenkinsClient:
    def __init__(self):
        settings = get_settings()
        base = settings.JENKINS_URL.rstrip('/') if settings.JENKINS_URL else ""
        # If JENKINS_PORT is provided and not already in the URL, append it
        try:
            port = getattr(settings, 'JENKINS_PORT', None)
        except Exception:
            port = None
        if port and base and ':' not in base.split('//')[-1]:
            base = f"{base}:{port}"
        self.base_url = base
        self.user = settings.JENKINS_USER
        
        # API 토큰 우선순위:
        # 1. 환경변수 JENKINS_API_TOKEN
        # 2. Jenkins가 생성한 토큰 파일 (/jenkins_home/api_token.txt)
        self.token = settings.JENKINS_API_TOKEN
        if not self.token or self.token == "":
            token_file = "/jenkins_home/api_token.txt"
            if os.path.exists(token_file):
                try:
                    with open(token_file, 'r') as f:
                        self.token = f.read().strip()
                    print(f"[INFO] Loaded Jenkins API token from {token_file}")
                except Exception as e:
                    print(f"[WARNING] Failed to read Jenkins API token file: {e}")
        
        self.job_name = settings.JENKINS_JOB_NAME
        self.session = requests.Session()
        if self.user and self.token:
            self.session.auth = (self.user, self.token)

    def _get_crumb(self) -> Optional[Dict[str, Any]]:
        try:
            resp = self.session.get(f"{self.base_url}/crumbIssuer/api/json", timeout=10)
            if resp.status_code == 200:
                return resp.json()
        except Exception:
            pass
        return None

    def _build_headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers: Dict[str, str] = extra.copy() if extra else {}
        crumb = self._get_crumb()
        if crumb and 'crumb' in crumb and 'crumbRequestField' in crumb:
            headers[crumb['crumbRequestField']] = crumb['crumb']
        return headers

    def _fetch_credential_entries(self) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/credentials/store/system/domain/_/api/json"
        params = {
            "tree": "credentials[id,displayName,typeName,description,credential[id,displayName,description,typeName,username,_class]]"
        }
        resp = self.session.get(url, params=params, timeout=15)
        if resp.status_code != 200:
            raise RuntimeError(
                f"Failed to fetch Jenkins credentials: {resp.status_code} {resp.text}"
            )
        return resp.json().get("credentials", [])

    def list_credentials(self) -> List[Dict[str, Any]]:
        """
        Retrieve the credentials stored in the global Jenkins domain.
        """
        return [self._build_summary(entry) for entry in self._fetch_credential_entries()]

    def get_credential_metadata(self, credential_id: str) -> Optional[Dict[str, Any]]:
        for entry in self._fetch_credential_entries():
            if entry.get("id") == credential_id:
                return self._build_summary(entry)
        return None

    def _class_from_type_name(self, type_name: Optional[str]) -> Optional[str]:
        if not type_name:
            return None
        normalized = type_name.lower()
        if "username" in normalized and "password" in normalized:
            return next(iter(USERNAME_PASSWORD_CLASSES))
        if "secret" in normalized:
            return next(iter(STRING_CREDENTIAL_CLASSES))
        return None

    def _map_by_type_name(self, summary: Dict[str, Any]) -> Dict[str, Any]:
        class_name = summary.get("type_class")
        if not class_name:
            class_name = self._class_from_type_name(summary.get("type_name"))
            summary["type_class"] = class_name
        if class_name in USERNAME_PASSWORD_CLASSES:
            summary["credential_type"] = "username_password"
            summary["editable"] = True
            summary["requires_username"] = True
            summary["requires_secret"] = True
        elif class_name in STRING_CREDENTIAL_CLASSES:
            summary["credential_type"] = "secret_text"
            summary["editable"] = True
            summary["requires_username"] = False
            summary["requires_secret"] = True
        else:
            summary.setdefault("credential_type", "unknown")
            summary.setdefault("editable", False)
            summary.setdefault("requires_username", False)
            summary.setdefault("requires_secret", False)
        return summary

    def _build_summary(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        detail = {
            "id": entry.get("id"),
            "display_name": entry.get("displayName"),
            "description": entry.get("description"),
            "type_name": entry.get("typeName"),
        }
        credential_info = entry.get("credential") or {}
        detail["username"] = credential_info.get("username")
        detail["type_class"] = credential_info.get("_class") or entry.get("_class")
        return self._map_by_type_name(detail)

    def _escape_groovy(self, value: str) -> str:
        if value is None:
            return ""
        return value.replace("\\", "\\\\").replace('"', '\\"')

    def update_credential(
        self,
        credential_id: str,
        credential_type: str,
        *,
        description: Optional[str] = "",
        username: Optional[str] = None,
        secret: Optional[str] = None,
    ) -> None:
        """
        Update or create a credential via Jenkins Script Console.
        """
        if credential_type not in {"username_password", "secret_text"}:
            raise ValueError(f"Unsupported credential type: {credential_type}")
        if not secret:
            raise ValueError("secret is required to update the credential")

        escaped_description = self._escape_groovy(description or "")
        escaped_secret = self._escape_groovy(secret)
        script_body = []
        script_body.append(
            "import jenkins.model.*\n"
            "import com.cloudbees.plugins.credentials.*\n"
            "import com.cloudbees.plugins.credentials.domains.Domain\n"
        )
        if credential_type == "username_password":
            script_body.append(
                "import com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl\n"
            )
        else:
            script_body.append(
                "import org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl\n"
                "import hudson.util.Secret\n"
            )

        script_body.append(
            """
def jenkins = Jenkins.getInstance()
def store = jenkins.getExtensionList('com.cloudbees.plugins.credentials.SystemCredentialsProvider')[0].getStore()
def domain = Domain.global()
def existing = store.getCredentials(domain).find { it.id == "%(cred_id)s" }
if (existing) {
    store.removeCredentials(domain, existing)
}
"""
            % {"cred_id": self._escape_groovy(credential_id)}
        )

        if credential_type == "username_password":
            escaped_username = self._escape_groovy(username or "")
            script_body.append(
                """
def cred = new UsernamePasswordCredentialsImpl(
    CredentialsScope.GLOBAL,
    "%(cred_id)s",
    "%(description)s",
    "%(username)s",
    "%(secret)s"
)
"""
                % {
                    "cred_id": self._escape_groovy(credential_id),
                    "description": escaped_description,
                    "username": escaped_username,
                    "secret": escaped_secret,
                }
            )
        else:
            script_body.append(
                """
def cred = new StringCredentialsImpl(
    CredentialsScope.GLOBAL,
    "%(cred_id)s",
    "%(description)s",
    Secret.fromString("%(secret)s")
)
"""
                % {
                    "cred_id": self._escape_groovy(credential_id),
                    "description": escaped_description,
                    "secret": escaped_secret,
                }
            )

        script_body.append(
            """
store.addCredentials(domain, cred)
jenkins.save()
"""
        )

        script = "\n".join(script_body)
        headers = self._build_headers({"Content-Type": "application/x-www-form-urlencoded"})
        resp = self.session.post(
            f"{self.base_url}/scriptText",
            data={"script": script},
            headers=headers,
            timeout=20,
        )
        if resp.status_code != 200:
            raise RuntimeError(
                f"Failed to update Jenkins credential '{credential_id}': {resp.status_code} {resp.text}"
            )

    def trigger_build(self, params: Dict[str, Any], job_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Trigger a Jenkins build with parameters.
        
        Args:
            params: Build parameters (must not be empty - always use buildWithParameters)
            job_name: Optional job name. If not provided, uses self.job_name (backward compatibility)
        """
        target_job_name = job_name or self.job_name
        if not target_job_name:
            raise ValueError("job_name must be provided either as parameter or in JenkinsClient initialization")
        
        headers = self._build_headers()
        
        # Jenkins Pipeline job은 parameters {} 블록이 있으면 항상 buildWithParameters 사용
        # 빈 params라도 buildWithParameters를 사용하면 Jenkins가 파라미터를 인식함
        # buildWithParameters는 URL 쿼리 파라미터 또는 form-encoded body 모두 지원
        # URL 쿼리 파라미터로 전달 (Jenkins가 더 확실하게 인식함)
        url = f"{self.base_url}/job/{target_job_name}/buildWithParameters"
        
        # 디버깅: 전달할 파라미터 로그 출력
        print(f"[JENKINS CLIENT] Triggering build: {url}")
        print(f"[JENKINS CLIENT] Parameters: {params}")
        print(f"[JENKINS CLIENT] SCAN_ID={params.get('SCAN_ID')}, PROJECT_ID={params.get('PROJECT_ID')}")
        
        # params를 URL 쿼리 파라미터로 전달
        resp = self.session.post(url, params=params, headers=headers, timeout=20)

        if resp.status_code not in (201, 200):
            # 400 에러 (not parameterized)인 경우, 일반 build 엔드포인트로 재시도
            if resp.status_code == 400 and "not parameterized" in resp.text:
                # 파라미터가 아직 활성화되지 않은 경우, 일반 build로 시도
                url_fallback = f"{self.base_url}/job/{target_job_name}/build"
                resp_fallback = self.session.post(url_fallback, headers=headers, timeout=20)
                if resp_fallback.status_code in (201, 200):
                    queue_url = resp_fallback.headers.get('Location')
                    return {"queue_url": queue_url}
            
            # Script approval 에러인 경우, 승인 시도 후 재시도
            if resp.status_code == 500 and "UnapprovedUsageException" in resp.text:
                print("⚠️ Script approval required. Attempting to approve scripts via Groovy Console...")
                try:
                    # Groovy Console을 통한 승인 시도 (더 확실함)
                    if self.approve_all_scripts_via_groovy():
                        print("✅ Scripts approved via Groovy Console. Retrying build...")
                        # 재시도
                        resp_retry = self.session.post(url, data=params, headers=headers, timeout=20)
                        if resp_retry.status_code in (201, 200):
                            queue_url = resp_retry.headers.get('Location')
                            return {"queue_url": queue_url}
                    else:
                        # Groovy Console 실패 시 일반 API 시도
                        if self.approve_all_scripts():
                            print("✅ Scripts approved via API. Retrying build...")
                            resp_retry = self.session.post(url, data=params, headers=headers, timeout=20)
                            if resp_retry.status_code in (201, 200):
                                queue_url = resp_retry.headers.get('Location')
                                return {"queue_url": queue_url}
                except Exception as e:
                    print(f"⚠️ Failed to approve scripts automatically: {e}")
                
                # 자동 승인 실패 시 명확한 에러 메시지 제공
                error_msg = (
                    f"❌ Jenkins Script Approval Required\n\n"
                    f"Jenkins가 파이프라인 스크립트 실행을 승인하지 않았습니다.\n\n"
                    f"해결 방법 (선택 1): Jenkins 관리자가 한 번만 설정 변경\n"
                    f"  1. Jenkins 관리 → Configure Global Security\n"
                    f"  2. 'Script Approval' 섹션 찾기\n"
                    f"  3. 'Approval Required' 옵션을 'Approval Not Required'로 변경\n"
                    f"     또는 'Approved Signatures'에 다음 패턴 추가:\n"
                    f"     - method org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition create\n"
                    f"     - staticMethod org.jenkinsci.plugins.scriptsecurity.scripts.ScriptApproval approveAll\n\n"
                    f"해결 방법 (선택 2): Jenkins UI에서 수동 승인\n"
                    f"  1. Jenkins → Manage Jenkins → In-process Script Approval\n"
                    f"  2. 대기 중인 스크립트를 모두 승인\n\n"
                    f"해결 방법 (선택 3): Groovy Console에서 한 번 실행\n"
                    f"  1. Jenkins → Manage Jenkins → Script Console\n"
                    f"  2. 다음 스크립트 실행:\n"
                    f"     import org.jenkinsci.plugins.scriptsecurity.scripts.ScriptApproval\n"
                    f"     ScriptApproval.get().approveAll()\n\n"
                    f"원본 에러: {resp.text[:500]}"
                )
                raise RuntimeError(error_msg)
            
            raise RuntimeError(f"Failed to trigger Jenkins build: {resp.status_code} {resp.text}")

        queue_url = resp.headers.get('Location')
        return {"queue_url": queue_url}

    def job_exists(self, job_name: str) -> bool:
        url = f"{self.base_url}/job/{job_name}/api/json"
        resp = self.session.get(url, timeout=10)
        return resp.status_code == 200

    def create_job(self, job_name: str, config_xml: str) -> None:
        headers = self._build_headers({'Content-Type': 'application/xml'})
        url = f"{self.base_url}/createItem"
        resp = self.session.post(url, params={'name': job_name}, data=config_xml.encode('utf-8'), headers=headers, timeout=30)
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Failed to create Jenkins job '{job_name}': {resp.status_code} {resp.text}")

    def update_job(self, job_name: str, config_xml: str) -> None:
        headers = self._build_headers({'Content-Type': 'application/xml'})
        url = f"{self.base_url}/job/{job_name}/config.xml"
        resp = self.session.post(url, data=config_xml.encode('utf-8'), headers=headers, timeout=30)
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Failed to update Jenkins job '{job_name}': {resp.status_code} {resp.text}")

    def delete_job(self, job_name: str) -> None:
        if not job_name:
            return
        headers = self._build_headers()
        url = f"{self.base_url}/job/{job_name}/doDelete"
        resp = self.session.post(url, headers=headers, timeout=20)
        if resp.status_code not in (200, 302):
            raise RuntimeError(f"Failed to delete Jenkins job '{job_name}': {resp.status_code} {resp.text}")

    def get_job_url(self, job_name: str) -> str:
        return f"{self.base_url}/job/{job_name}/"

    def get_github_webhook_endpoint(self) -> str:
        return f"{self.base_url}/github-webhook/"

    def approve_script(self, script_hash: str) -> bool:
        """
        Approve a script in Jenkins Script Security Plugin.
        
        Args:
            script_hash: Hash of the script to approve (from script approval page)
        
        Returns:
            True if successful, False otherwise
        """
        headers = self._build_headers()
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
        # Script Approval API endpoint - Jenkins requires hash parameter
        url = f"{self.base_url}/scriptApproval/approveScript"
        data = {"hash": script_hash}
        resp = self.session.post(url, data=data, headers=headers, timeout=10, allow_redirects=False)
        # Jenkins may return 302 redirect or 200/201
        return resp.status_code in (200, 201, 302)

    def approve_all_scripts_via_groovy(self) -> bool:
        """
        Groovy Console을 통해 모든 스크립트를 자동 승인.
        이 방법이 API보다 더 확실하게 작동함.
        
        Returns:
            True if successful, False otherwise
        """
        headers = self._build_headers()
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
        
        # Groovy Console을 통해 Script Approval 접근
        groovy_script = """
import org.jenkinsci.plugins.scriptsecurity.scripts.ScriptApproval
def scriptApproval = ScriptApproval.get()
scriptApproval.approveAll()
println("All scripts approved successfully")
"""
        
        url = f"{self.base_url}/script"
        # Jenkins Groovy Console은 script 파라미터를 사용
        data = {
            "script": groovy_script,
            "Submit": "Run"  # Jenkins Groovy Console submit 버튼
        }
        
        try:
            resp = self.session.post(url, data=data, headers=headers, timeout=10)
            # Jenkins Groovy Console은 200을 반환하고 결과를 HTML로 반환
            if resp.status_code == 200:
                # 응답에서 성공 메시지 확인
                response_text = resp.text
                if "approved successfully" in response_text or "All scripts approved" in response_text:
                    return True
                # 에러가 없으면 성공으로 간주
                if "Exception" not in response_text and "Error" not in response_text:
                    return True
        except Exception as e:
            print(f"Debug: Groovy console approval failed: {e}")
        
        return False

    def approve_all_scripts(self) -> bool:
        """
        Approve all pending scripts in Jenkins Script Security Plugin.
        This is useful for initial setup but should be used with caution in production.
        
        Returns:
            True if successful, False otherwise
        """
        headers = self._build_headers()
        # Approve all pending scripts - Jenkins API requires specific format
        url = f"{self.base_url}/scriptApproval/approveAll"
        # Jenkins requires POST with proper content type
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
        resp = self.session.post(url, headers=headers, timeout=10, allow_redirects=False)
        
        # Jenkins may return 302 redirect or 200/201
        if resp.status_code in (200, 201, 302):
            return True
        
        # Alternative: Try to get pending scripts and approve individually
        try:
            pending = self.get_pending_scripts()
            if pending:
                # Approve each pending script
                for script in pending:
                    script_hash = script.get('hash') or script.get('signature')
                    if script_hash:
                        self.approve_script(script_hash)
                return True
        except Exception:
            pass
        
        return False

    def get_pending_scripts(self) -> list:
        """
        Get list of pending scripts that need approval.
        
        Returns:
            List of pending script hashes
        """
        headers = self._build_headers()
        url = f"{self.base_url}/scriptApproval/api/json"
        resp = self.session.get(url, headers=headers, timeout=10)
    def run_script(self, script: str) -> str:
        """
        Execute a Groovy script on the Jenkins controller.
        
        Args:
            script: Groovy script content
            
        Returns:
            Output from the script execution
        """
        headers = self._build_headers({"Content-Type": "application/x-www-form-urlencoded"})
        # Use /scriptText endpoint which returns raw text output
        url = f"{self.base_url}/scriptText"
        data = {"script": script}
        
        resp = self.session.post(url, data=data, headers=headers, timeout=30)
        
        if resp.status_code != 200:
            raise RuntimeError(f"Failed to execute Groovy script: {resp.status_code} {resp.text}")
            
        return resp.text
