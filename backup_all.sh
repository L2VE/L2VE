#!/bin/bash
set -euo pipefail

# === 공통 설정 ===
TS=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$HOME/L2VE_backups"

POSTGRES_CONTAINER_NAME="l2ve-postgres"
POSTGRES_DB="postdb"
POSTGRES_USER="admin"

JENKINS_HOME_VOL="l2ve_jenkins_home"
JENKINS_PROJECTS_VOL="l2ve_jenkins_projects"

mkdir -p "$BACKUP_DIR"

echo "=== PostgreSQL 컨테이너 ID 찾는 중... ==="
CID=$(sudo docker ps -qf "name=$POSTGRES_CONTAINER_NAME")

if [ -z "$CID" ]; then
  echo "ERROR: Postgres 컨테이너를 찾을 수 없습니다: name=$POSTGRES_CONTAINER_NAME"
  exit 1
fi
echo "찾은 컨테이너 ID: $CID"

# ---------------------------------------------------------
# 1. Postgres DB 백업
# ---------------------------------------------------------
DB_BACKUP_FILE="$BACKUP_DIR/post_backup_${TS}.sql"
echo "=== PostgreSQL 백업 시작: $DB_BACKUP_FILE ==="
sudo docker exec -t "$CID" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$DB_BACKUP_FILE"
echo "PostgreSQL 백업 완료: $DB_BACKUP_FILE"

# ---------------------------------------------------------
# 2. Jenkins 볼륨 "현재 상태" 전체 tar.gz (2개)
# ---------------------------------------------------------
JENKINS_HOME_FULL="$BACKUP_DIR/jenkins_home_full_${TS}.tar.gz"
JENKINS_PROJECTS_FULL="$BACKUP_DIR/jenkins_projects_full_${TS}.tar.gz"

echo "=== Jenkins Home 볼륨 전체 백업 (full) 시작: $JENKINS_HOME_FULL ==="
sudo docker run --rm \
  -v "${JENKINS_HOME_VOL}":/data \
  -v "${BACKUP_DIR}":/backup \
  alpine sh -c "cd /data && tar czf /backup/jenkins_home_full_${TS}.tar.gz ."
echo "Jenkins Home 볼륨 전체 백업 완료: $JENKINS_HOME_FULL"

echo "=== Jenkins Projects 볼륨 전체 백업 (full) 시작: $JENKINS_PROJECTS_FULL ==="
sudo docker run --rm \
  -v "${JENKINS_PROJECTS_VOL}":/data \
  -v "${BACKUP_DIR}":/backup \
  alpine sh -c "cd /data && tar czf /backup/jenkins_projects_full_${TS}.tar.gz ."
echo "Jenkins Projects 볼륨 전체 백업 완료: $JENKINS_PROJECTS_FULL"

# ---------------------------------------------------------
# 3. Jenkins Home 볼륨 sanitized tar.gz
#    (볼륨은 그대로 두고, tar --exclude 로만 필터링)
# ---------------------------------------------------------
JENKINS_HOME_SANITIZED="$BACKUP_DIR/jenkins_home_sanitized_${TS}.tar.gz"

echo "=== Jenkins Home sanitized 백업 (tar --exclude, 볼륨은 그대로) 시작 ==="
sudo docker run --rm \
  -v "${JENKINS_HOME_VOL}":/jenkins \
  -v "${BACKUP_DIR}":/backup \
  alpine sh -c "cd /jenkins && tar czf /backup/jenkins_home_sanitized_${TS}.tar.gz \
      --exclude='secrets/*' \
      --exclude='users/*' \
      --exclude='plugins/*' \
      --exclude='config.xml' \
      --exclude='jenkins.install.*' \
      --exclude='jenkins.yaml' \
      --exclude='casc_configs/*' \
      ."
echo "Jenkins Home sanitized 백업 완료: $JENKINS_HOME_SANITIZED"

echo "=== 모든 백업 완료 ==="
echo "생성된 파일:"
echo "  - $DB_BACKUP_FILE"
echo "  - $JENKINS_HOME_FULL"
echo "  - $JENKINS_PROJECTS_FULL"
echo "  - $JENKINS_HOME_SANITIZED"
echo "백업 위치: $BACKUP_DIR"
