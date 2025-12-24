import jenkins.model.*
import com.cloudbees.plugins.credentials.*
import com.cloudbees.plugins.credentials.domains.Domain
import com.cloudbees.plugins.credentials.impl.*
import org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl
import hudson.util.Secret

// Jenkins 인스턴스
def jenkins = Jenkins.getInstance()

println "==> Starting Jenkins initialization..."

// ==========================================
// 1. GitHub Credential 설정 (JCasC 백업)
// ==========================================
println "==> Setting up GitHub credential..."

def credentialsStore = jenkins.getExtensionList('com.cloudbees.plugins.credentials.SystemCredentialsProvider')[0].getStore()
def domain = Domain.global()
def existingCredential = credentialsStore.getCredentials(domain).find { it.id == "github-token" }
def githubUsername = System.getenv('GITHUB_USERNAME') ?: 'git'
def githubToken = System.getenv('GITHUB_TOKEN') ?: ''

// 기존 credential이 없거나 타입이 다르면 재생성
if (!existingCredential || !(existingCredential instanceof UsernamePasswordCredentialsImpl)) {
    if (existingCredential) {
        println "==> Removing existing github-token credential (type: ${existingCredential.class.simpleName})"
        credentialsStore.removeCredentials(domain, existingCredential)
    }
    
    if (githubToken) {
        try {
            def usernamePasswordCredential = new UsernamePasswordCredentialsImpl(
                CredentialsScope.GLOBAL,
                "github-token",
                "GitHub Personal Access Token",
                githubUsername ?: "x",
                githubToken
            )
            credentialsStore.addCredentials(domain, usernamePasswordCredential)
            println "==> GitHub credential created successfully"
        } catch (Exception e) {
            println "==> WARNING: Failed to create GitHub credential: ${e.getMessage()}"
        }
    } else {
        println "==> WARNING: GITHUB_TOKEN not set, skipping credential creation"
    }
} else {
    // env 토큰이 있고 기존 값과 다르거나 비어 있으면 갱신
    def existingUser = existingCredential.username
    def existingPass = existingCredential.password?.getPlainText()
    if (githubToken && (!existingPass || existingPass != githubToken || existingUser != githubUsername)) {
        println "==> Updating github-token credential from environment"
        credentialsStore.removeCredentials(domain, existingCredential)
        def usernamePasswordCredential = new UsernamePasswordCredentialsImpl(
            CredentialsScope.GLOBAL,
            "github-token",
            "GitHub Personal Access Token",
            githubUsername ?: "x",
            githubToken
        )
        credentialsStore.addCredentials(domain, usernamePasswordCredential)
        println "==> GitHub credential updated successfully"
    } else {
        println "==> GitHub credential already exists"
    }
}

// ==========================================
// 2. Backend API Key & Jenkins Callback Secret
// ==========================================
def backendKey = System.getenv('BACKEND_SERVICE_API_KEY') ?: ''
def backendCred = credentialsStore.getCredentials(domain).find { it.id == "backend-api-key" }

if (backendKey) {
    if (!backendCred || !(backendCred instanceof StringCredentialsImpl) || backendCred.secret?.plainText != backendKey) {
        if (backendCred) {
            credentialsStore.removeCredentials(domain, backendCred)
        }
        try {
            def stringCred = new StringCredentialsImpl(
                CredentialsScope.GLOBAL,
                "backend-api-key",
                "Backend service API key",
                Secret.fromString(backendKey)
            )
            credentialsStore.addCredentials(domain, stringCred)
            println "==> backend-api-key credential set"
        } catch (Exception e) {
            println "==> WARNING: Failed to set backend-api-key credential: ${e.getMessage()}"
        }
    } else {
        println "==> backend-api-key credential already up-to-date"
    }
} else {
    println "==> WARNING: BACKEND_SERVICE_API_KEY not set, skipping backend credential"
}

def callbackSecret = System.getenv('JENKINS_CALLBACK_SECRET') ?: ''
def callbackCred = credentialsStore.getCredentials(domain).find { it.id == "jenkins-callback-secret" }

if (callbackSecret) {
    if (!callbackCred || !(callbackCred instanceof StringCredentialsImpl) || callbackCred.secret?.plainText != callbackSecret) {
        if (callbackCred) {
            credentialsStore.removeCredentials(domain, callbackCred)
        }
        try {
            def stringCred = new StringCredentialsImpl(
                CredentialsScope.GLOBAL,
                "jenkins-callback-secret",
                "Jenkins callback shared secret",
                Secret.fromString(callbackSecret)
            )
            credentialsStore.addCredentials(domain, stringCred)
            println "==> jenkins-callback-secret credential set"
        } catch (Exception e) {
            println "==> WARNING: Failed to set jenkins-callback-secret credential: ${e.getMessage()}"
        }
    } else {
        println "==> jenkins-callback-secret credential already up-to-date"
    }
} else {
    println "==> WARNING: JENKINS_CALLBACK_SECRET not set, skipping callback credential"
}

// ==========================================
// 3. LangSmith API Key
// ==========================================
def langsmithKey = System.getenv('LANGCHAIN_API_KEY') ?: ''
def langsmithCred = credentialsStore.getCredentials(domain).find { it.id == "langsmith-api-key" }

if (langsmithKey) {
    if (!langsmithCred || !(langsmithCred instanceof StringCredentialsImpl) || langsmithCred.secret?.plainText != langsmithKey) {
        if (langsmithCred) {
            credentialsStore.removeCredentials(domain, langsmithCred)
        }
        try {
            def stringCred = new StringCredentialsImpl(
                CredentialsScope.GLOBAL,
                "langsmith-api-key",
                "LangSmith API Key",
                Secret.fromString(langsmithKey)
            )
            credentialsStore.addCredentials(domain, stringCred)
            println "==> langsmith-api-key credential set"
        } catch (Exception e) {
            println "==> WARNING: Failed to set langsmith-api-key credential: ${e.getMessage()}"
        }
    } else {
        println "==> langsmith-api-key credential already up-to-date"
    }
} else {
    println "==> WARNING: LANGCHAIN_API_KEY not set, skipping LangSmith credential"
}

// ==========================================
// 3. Job 생성 (프로젝트 생성 시 동적으로 생성됨)
// ==========================================
println "==> Jobs will be created dynamically via API when projects are created"

jenkins.save()
println "==> Jenkins initialization completed"
