#!/bin/bash
set -euo pipefail

### === 파라미터 체크 === ###
if [[ $# -ne 1 ]]; then
    echo "사용법: $0 <jenkins_jobs_backup.tar.gz 경로>"
    exit 1
fi

BACKUP_JOBS_TGZ="$1"

if [[ ! -f "$BACKUP_JOBS_TGZ" ]]; then
    echo "백업 파일이 존재하지 않습니다: $BACKUP_JOBS_TGZ"
    exit 1
fi


### === 환경 설정 === ###
VOL_HOME="l2ve_jenkins_home"
VOL_PROJECTS="l2ve_jenkins_projects"

SERVICE_BACKEND="backend"
SERVICE_JENKINS="jenkins"

IMG_BACKEND="l2ve-backend"
IMG_JENKINS="l2ve-jenkins"


echo "=== Jenkins jobs 복구 시작 ==="
echo "백업 파일: $BACKUP_JOBS_TGZ"


echo "=== 1. backend + jenkins STOP & REMOVE ==="
sudo docker compose stop $SERVICE_BACKEND || true
sudo docker compose rm -f $SERVICE_BACKEND || true

sudo docker compose stop $SERVICE_JENKINS || true
sudo docker compose rm -f $SERVICE_JENKINS || true


echo "=== 2. 기존 이미지 삭제 ==="
sudo docker rmi $IMG_BACKEND || true
sudo docker rmi $IMG_JENKINS || true


echo "=== 3. Jenkins 관련 볼륨 삭제 ==="
sudo docker volume rm $VOL_HOME || true
sudo docker volume rm $VOL_PROJECTS || true


echo "=== 4. backend + jenkins만 build ==="
sudo docker compose build $SERVICE_BACKEND $SERVICE_JENKINS


echo "=== 5. backend + jenkins만 재기동 ==="
sudo docker compose up -d $SERVICE_BACKEND $SERVICE_JENKINS
echo "컨테이너 안정화 대기 (10초)"
sleep 10


echo "=== 6. 복구 준비 위해 두 서비스 STOP ==="
sudo docker compose stop $SERVICE_BACKEND
sudo docker compose stop $SERVICE_JENKINS


echo "=== 7. Jenkins Home 볼륨에 jobs 디렉토리 복구 ==="

sudo docker run --rm \
    -v "$VOL_HOME":/jenkins_home \
    -v "$(dirname "$BACKUP_JOBS_TGZ")":/backup \
    alpine sh -c "
        set -e
        cd /jenkins_home

        echo '기존 jobs 디렉토리 백업'
        if [ -d jobs ]; then
            mv jobs jobs.bak_$(date +%Y%m%d_%H%M%S)
        fi

        echo 'jobs 복구'
        tar xzf /backup/$(basename "$BACKUP_JOBS_TGZ") -C /jenkins_home

        echo '권한 조정'
        chown -R 1000:1000 /jenkins_home/jobs
    "


echo "=== 8. backend + jenkins 다시 기동 ==="
sudo docker compose up -d $SERVICE_BACKEND $SERVICE_JENKINS


echo "=== 🎉 완료: Jenkins jobs 디렉토리 복구 성공! ==="
