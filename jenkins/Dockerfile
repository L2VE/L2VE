FROM jenkins/jenkins:lts

# root 권한으로 실행
USER root

# Docker CLI, Python3, Git 설치
RUN apt-get update && \
    apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    python3 \
    python3-pip \
    python3-venv \
    unzip \
    git && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && \
    apt-get install -y docker-ce-cli && \
    rm -rf /var/lib/apt/lists/*

# Jenkins 플러그인 자동 설치
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt

# JCasC 설정 파일 복사
COPY jenkins.yaml /var/jenkins_home/jenkins.yaml
ENV CASC_JENKINS_CONFIG=/var/jenkins_home/jenkins.yaml

# Logo 파일 복사
COPY logo.png /var/jenkins_home/userContent/images/logo.png

# Job DSL 스크립트 복사
COPY jobs.groovy /var/jenkins_home/jobs.groovy

# 초기화 스크립트 복사
COPY init.groovy.d/ /usr/share/jenkins/ref/init.groovy.d/

# 권한 설정
RUN chown -R jenkins:jenkins /var/jenkins_home

# Jenkins 유저로 전환
USER jenkins

# Java 옵션 설정
ENV JAVA_OPTS="-Djava.net.preferIPv4Stack=true -Djenkins.install.runSetupWizard=false -Dpermissive-script-security.enabled=no_security"