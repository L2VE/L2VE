#!/bin/bash
set -euo pipefail

### === 파라미터 체크 === ###
if [[ $# -lt 1 || $# -gt 2 ]]; then
    echo "사용법:"
    echo "  $0 <backup.sql 경로>             # 기존 DB에 복구"
    echo "  $0 <backup.sql 경로> <DB_NAME>    # DB drop 후 생성 + 복구"
    exit 1
fi

SQL_FILE="$1"
TARGET_DB="${2:-""}"   # DB 이름이 옵션으로 들어오면 drop/create 수행

if [[ ! -f "$SQL_FILE" ]]; then
    echo "SQL 파일이 존재하지 않습니다: $SQL_FILE"
    exit 1
fi

### === 설정값 (환경에 맞게 필요하면 수정) === ###
POSTGRES_CONTAINER="l2ve-postgres"
DB_USER="admin"

echo "=== SQL 복구 작업 시작 ==="
echo "SQL 파일: $SQL_FILE"


### === 1. Postgres 컨테이너 찾기 === ###
CID=$(sudo docker ps --filter "name=$POSTGRES_CONTAINER" --format "{{.ID}}")
if [[ -z "$CID" ]]; then
    echo "Postgres 컨테이너($POSTGRES_CONTAINER)를 찾을 수 없습니다!"
    exit 1
fi

echo "Postgres 컨테이너 ID: $CID"


### === 2. DB drop/create 옵션 처리 === ###
if [[ -n "$TARGET_DB" ]]; then
    echo "=== DB '${TARGET_DB}' drop 및 재생성 ==="
    
    sudo docker exec -i "$CID" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$TARGET_DB\";"
    sudo docker exec -i "$CID" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$TARGET_DB\";"

    RESTORE_DB="$TARGET_DB"
else
    echo "DB_NAME이 없으므로 기존 DB에 그대로 복구합니다."
    RESTORE_DB="postgres"
fi


### === 3. SQL 복구 실행 === ###
echo "=== SQL 복구 시작 (DB: $RESTORE_DB) ==="

sudo docker exec -i "$CID" psql -U "$DB_USER" -d "$RESTORE_DB" < "$SQL_FILE"

echo "=== 🎉 SQL 복구 완료! ==="
