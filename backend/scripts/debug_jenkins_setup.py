
import os
import sys
import json
import requests

# Add backend directory to path so imports work
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
sys.path.append(backend_dir)

from app.config import get_settings
from app.utils.jenkins_client import JenkinsClient

def debug_jenkins_setup():
    print("==> Starting Jenkins Debug (Groovy Deep Dive)...")

    # 1. Connect
    try:
        client = JenkinsClient()
        print(f"  - Jenkins URL: {client.base_url}")
    except Exception as e:
        print(f"  - Init Error: {e}")
        return

    # 2. Define Groovy Script
    groovy_script = """
import jenkins.model.*
import com.cloudbees.plugins.credentials.*
import com.cloudbees.plugins.credentials.impl.*
import com.cloudbees.plugins.credentials.domains.*
import org.jenkinsci.plugins.workflow.job.*
import org.jenkinsci.plugins.workflow.cps.*
import hudson.plugins.git.*

println "--- CREDENTIALS CHECK ---"
def creds = com.cloudbees.plugins.credentials.CredentialsProvider.lookupCredentials(
    com.cloudbees.plugins.credentials.common.StandardUsernameCredentials.class,
    Jenkins.instance,
    null,
    null
)
def ghCred = creds.find { it.id == "github-token" }
if (ghCred) {
    println "Found 'github-token':"
    println "  Class: " + ghCred.getClass().getName()
    println "  Username: '" + ghCred.username + "'"
    println "  Description: " + ghCred.description
    if (ghCred instanceof UsernamePasswordCredentialsImpl) {
         def pass = ghCred.password.getPlainText()
         println "  Password Length: " + pass.length()
         println "  Password Prefix: " + (pass.length() > 3 ? pass.substring(0,3) : "too short") + "..."
    } else {
         println "  Type: Not UsernamePasswordCredentialsImpl"
    }
} else {
    println "ERROR: 'github-token' credential NOT FOUND in System Store."
}

println "\\n--- JOB CHECK (vshop) ---"
def job = Jenkins.instance.getItem("vshop")
if (job) {
    println "Job 'vshop' found."
    if (job instanceof WorkflowJob) {
        def defn = job.getDefinition()
        println "  Definition Class: " + defn.getClass().getName()
        
        if (defn instanceof CpsScmFlowDefinition) {
            def scm = defn.getScm()
            println "  SCM Class: " + scm.getClass().getName()
            if (scm instanceof GitSCM) {
                println "  GitSCM Config:"
                println "    UserRemoteConfigs: " + scm.userRemoteConfigs.size()
                scm.userRemoteConfigs.each { c ->
                    println "      Url: " + c.url
                    println "      CredentialsId: '" + c.credentialsId + "'"
                }
            }
        } else if (defn instanceof CpsFlowDefinition) {
            println "  Type: Inline Script (NOT GitSCM Definition)"
            println "  Script Snippet: " + (defn.script.length() > 50 ? defn.script.substring(0,50) + "..." : defn.script)
        }
    } else {
        println "  Job Type: " + job.getClass().getName()
    }
} else {
    println "Job 'vshop' NOT FOUND."
    println "All Jobs: " + Jenkins.instance.getAllItems(Job.class).collect { it.name }
}
"""

    # 3. Execute Script
    print("\n[Executing Groovy Script on Jenkins Controller...]")
    try:
        output = client.run_script(groovy_script)
        print(output)
    except Exception as e:
        print(f"  - Groovy Execution Failed: {e}")
        # Fallback print if 404 or auth error persists on script endpoint
        print("  (Check if user has Overall/Administer permissions)")

if __name__ == "__main__":
    debug_jenkins_setup()
