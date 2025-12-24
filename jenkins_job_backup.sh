#!/bin/bash
set -euo pipefail

TS=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$HOME/L2VE_backups"
JENKINS_HOME_VOL="l2ve_jenkins_home"

mkdir -p "$BACKUP_DIR"

echo "=== Jenkins jobs + builds만 백업 시작 ==="
sudo docker run --rm \
  -v "${JENKINS_HOME_VOL}":/jenkins \
  -v "${BACKUP_DIR}":/backup \
  alpine sh -c "
    set -e
    cd /jenkins
    # jobs 디렉토리만 백업 (각 잡 설정 + 빌드 기록 포함)
    tar czf /backup/jenkins_jobs_builds_${TS}.tar.gz jobs
  "

echo "완료: $BACKUP_DIR/jenkins_jobs_builds_${TS}.tar.gz"
