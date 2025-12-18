import jenkins.model.*
import hudson.plugins.git.*
import groovy.json.JsonSlurper

/**
 * Attempt to auto-set Jenkins URL if not provided.
 * Priority:
 *   1) JENKINS_URL env (respects existing config)
 *   2) Public IP from https://api.myip.com
 *   3) Host IP via `ip route get 1.1.1.1`
 */
println "==> Auto-setting Jenkins URL if missing..."

def loc = JenkinsLocationConfiguration.get()
def existingUrl = loc?.url ?: ""
def envUrl = System.getenv("JENKINS_URL")

def resolvedUrl = null

def needsUpdate = (!existingUrl) || existingUrl.contains("localhost") || existingUrl.contains("jenkins:")

if (needsUpdate) {
    // Try public IP first
    try {
        def resp = new URL("https://api.myip.com").text
        def parsed = new JsonSlurper().parseText(resp)
        if (parsed?.ip) {
            resolvedUrl = "http://${parsed.ip}:10218/"
            println "==> Detected public IP via api.myip.com: ${parsed.ip}"
        }
    } catch (Exception e) {
        println "==> WARNING: Failed to get public IP from api.myip.com: ${e.getMessage()}"
    }

    // Fallback to host IP
    if (!resolvedUrl) {
        try {
            def proc = ["sh", "-c", "ip route get 1.1.1.1 | awk '{print \$7; exit}'"].execute()
            def ip = proc.text?.trim()
            if (ip) {
                resolvedUrl = "http://${ip}:10218/"
                println "==> Detected host IP via ip route: ${ip}"
            }
        } catch (Exception e) {
            println "==> WARNING: Failed to get host IP via ip route: ${e.getMessage()}"
        }
    }
    // Fallback to env as last resort
    if (!resolvedUrl && envUrl && envUrl.trim()) {
        resolvedUrl = envUrl.trim()
        println "==> Using JENKINS_URL from environment as fallback: ${resolvedUrl}"
    }
} else {
    println "==> Existing Jenkins URL retained: ${existingUrl}"
}

if (resolvedUrl) {
    try {
        loc.setUrl(resolvedUrl)
        loc.save()
        println "==> Jenkins URL set to: ${resolvedUrl}"
    } catch (Exception e) {
        println "==> WARNING: Failed to set Jenkins URL: ${e.getMessage()}"
    }
} else {
    println "==> Jenkins URL not changed (no detected address)."
}
