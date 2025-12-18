import jenkins.model.*
import hudson.model.User
import jenkins.security.ApiTokenProperty

// 자동으로 관리자 API 토큰을 생성해 /var/jenkins_home/api_token.txt에 저장한다.
def log = { msg -> println "==> [API TOKEN] ${msg}" }

def userId = System.getenv('JENKINS_ADMIN_USER') ?: 'admin'
def tokenName = "auto-generated-token"
def tokenFile = new File("/var/jenkins_home/api_token.txt")

try {
    // 이미 토큰 파일이 있으면 재생성하지 않음
    if (tokenFile.exists() && tokenFile.text.trim()) {
        log("Token file already exists. Skipping generation.")
        return
    }

    def user = User.get(userId, false, null)
    if (user == null) {
        log("Admin user '${userId}' not found. Skipping token generation.")
        return
    }

    def prop = user.getProperty(ApiTokenProperty.class)
    if (prop == null) {
        prop = new ApiTokenProperty()
        user.addProperty(prop)
    }

    def store = prop.getTokenStore()

    // 동일 이름의 토큰이 있으면 삭제 후 새로 생성 (plain 값을 얻기 위함)
    def existing = store.getTokenListSortedByName().find { it.name == tokenName }
    if (existing) {
        store.revokeToken(existing.getUuid())
        log("Revoked existing token named '${tokenName}'.")
    }

    def result = store.generateNewToken(tokenName)
    def tokenValue = result?.plainValue

    if (!tokenValue) {
        log("Failed to generate token value.")
        return
    }

    tokenFile.write(tokenValue + "\n")
    tokenFile.setReadable(true, true)
    tokenFile.setWritable(true, true)
    tokenFile.setExecutable(false, true)

    user.save()
    log("Generated new API token for user '${userId}' and wrote to ${tokenFile.absolutePath}")
} catch (Exception e) {
    log("Token generation failed: ${e.getMessage()}")
}
