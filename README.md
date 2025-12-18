<a id="top"></a>
# 🔐 L2VE - LLM-based Vulnerability Analysis Platform

> 🔎 **LLM 기반 취약점 분석 플랫폼** — Jenkins CI/CD와 통합되어 GitHub 저장소의 소스코드를 자동으로 분석하고 보안 취약점을 탐지합니다.

<a id="toc"></a>
## 📚 목차
✨ [프로젝트 개요](#overview) · 🧰 [기술 스택](#tech-stack) · 🧩 [시스템 구성](#system) · 🗂️ [프로젝트 구조](#project-structure) · 🚀 [시작하기](#getting-started) · 🐘 [데이터베이스](#database) · 🧾 [API 문서](#api-docs) <br>
🤖 [Jenkins 통합](#jenkins-integration) · 🧯 [문제 해결](#troubleshooting) · 🧑‍💻 [개발](#development) · ♻️ [백업 및 복구](#backup-restore) · 🛡️ [보안](#security) · 📈 [모니터링](#monitoring) · 🚚 [배포](#deployment) · 📚 [문서](#documents) · 🏷️ [버전](#version) <br>
📘 [LLM 기반 취약점 분석 가이드라인](#GuideLine)

<a id="overview"></a>
## ✨ 프로젝트 개요

L2VE는 LLM을 활용한 자동화된 취약점 분석 플랫폼입니다. Jenkins CI/CD와 통합되어 GitHub 저장소의 소스코드를 자동으로 분석하고 보안 취약점을 탐지합니다.

<a id="tech-stack"></a>
## 🧰 기술 스택

<a id="tech-frontend"></a>
### 🎨 Frontend
- React 19
- Vite
- Material-UI
- TailwindCSS
- Axios

<a id="tech-backend"></a>
### 🧠 Backend
- FastAPI
- Python 3.12
- SQLAlchemy
- JWT 인증
- Rate Limiting

<a id="tech-database"></a>
### 🗄️ Database
- PostgreSQL 16 + pgvector (메인 데이터베이스)

<a id="tech-cicd"></a>
### 🤖 CI/CD
- Jenkins LTS
- Job DSL
- JCasC (Jenkins Configuration as Code)

<a id="tech-infra"></a>
### 🧱 Infrastructure
- Docker
- Docker Compose
- Nginx

<a id="system"></a>
## 🧩 시스템 구성

| 구성 요소 | 스택 | 포트(Host) |
| --- | --- | --- |
| Frontend | React + Nginx | `80` |
| Backend | FastAPI | `3000` |
| PostgreSQL | PostgreSQL 16 + pgvector | `5433` |
| Jenkins | Jenkins LTS | `10218` |

<a id="project-structure"></a>
## 🗂️ 프로젝트 구조

- `frontend/`: Frontend 애플리케이션 (React + Nginx)
- `backend/`: Backend 애플리케이션 (FastAPI)
- `jenkins/`: Jenkins 설정 (JCasC, init 스크립트 등)
- `langgraph-scanner/`: LangGraph 기반 보안 스캐너 (Full Scan)
- `langgraph-scan/`: Quick Scan 구성/리소스
- `init-scripts/`: DB 초기화 스크립트
- `scripts/`: 운영/자동화 스크립트

<details>
<summary><b>폴더 트리 보기</b></summary>

```text
L2VE/
├── docker-compose.yml       # Docker Compose 설정
├── .env                     # 환경 변수
├── README.md                # 프로젝트 문서
│
├── frontend/                # Frontend 애플리케이션
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── src/
│       ├── components/      # 재사용 컴포넌트
│       ├── pages/           # 페이지 컴포넌트
│       └── services/        # API 서비스
│
├── backend/                 # Backend 애플리케이션
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py          # FastAPI 애플리케이션
│       ├── routers/         # API 라우터
│       ├── models/          # 데이터베이스 모델
│       ├── schemas/         # Pydantic 스키마
│       ├── services/        # 비즈니스 로직
│       └── utils/           # 유틸리티
│
├── jenkins/                 # Jenkins 설정
│   ├── Dockerfile
│   ├── jenkins.yaml         # JCasC 설정
│   ├── jobs.groovy          # Job DSL
│   ├── Jenkinsfile          # Pipeline 스크립트
│   └── init.groovy.d/       # 초기화 스크립트
│
├── langgraph-scanner/       # LangGraph 기반 보안 스캐너
│   ├── main.py              # 스캐너 메인
│   ├── requirements.txt     # Python 의존성
│   ├── src/                 # 스캐너 소스코드
│   └── results/             # 스캔 결과 (gitignore)
│
├── init-scripts/            # 데이터베이스 초기화 스크립트
│   └── postgres/
│
├── scripts/                 # 자동화 스크립트
│   ├── setup-jenkins-token.sh
│   └── generate-jenkins-token.py
│
└── data/                    # 데이터 저장소
    ├── jenkins_home/        # Jenkins 데이터
    └── postgres-backups/    # PostgreSQL 백업
```

</details>

<a id="getting-started"></a>
## 🚀 시작하기

> ⚡ TL;DR: `cp .env.example .env` → `docker compose up -d` → `http://localhost`

<a id="prerequisites"></a>
### ✅ 사전 요구사항

- Docker 20.10 이상
- Docker Compose 2.0 이상
- 디스크 공간 6GB 이상

<a id="env-setup"></a>
### 🧩 환경 변수 설정

`.env` 파일을 생성하고 필요한 환경 변수를 설정합니다.

```bash
# .env 파일 복사
cp .env.example .env

# .env 파일 수정
vi .env
```

> ✅ 프로덕션에서는 아래 항목을 꼭 변경하세요: `POSTGRES_PASSWORD`, `SECRET_KEY`, `JENKINS_ADMIN_PASSWORD`, `JENKINS_API_TOKEN`, `JENKINS_CALLBACK_SECRET`, `BACKEND_SERVICE_API_KEY`, `GITHUB_TOKEN`

<details>
<summary><b>주요 환경 변수(요약) 보기</b></summary>

- Database
  - Postgres 컨테이너: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_EXTERNAL_PORT`
  - Backend DB 연결: `DB_ENGINE`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Backend
  - 서버 설정: `API_HOST`, `API_PORT`, `DEBUG`
  - 인증: `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`
- Jenkins
  - Jenkins 접속: `JENKINS_URL` (Docker 내부 통신 기준: `http://jenkins:8080`)
  - 관리자 계정: `JENKINS_ADMIN_USER`, `JENKINS_ADMIN_PASSWORD`
  - API 연동: `JENKINS_USER`, `JENKINS_API_TOKEN`, `JENKINS_GIT_CREDENTIALS_ID`
  - 콜백/인증: `BACKEND_API_BASE`, `JENKINS_CALLBACK_SECRET`, `BACKEND_SERVICE_API_KEY`
  - Git 크레덴셜: `GITHUB_USERNAME`, `GITHUB_TOKEN`
- LLM
  - `GROQ_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY`
  - Bedrock: `AWS_BEARER_TOKEN_BEDROCK`, `BEDROCK_AWS_REGION`
- SMTP (알림)
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_USE_TLS`, `SMTP_USE_SSL`, `SMTP_REPLY_TO`
- Frontend
  - `VITE_API_BASE_URL`, `FRONTEND_PORT`
- Scanner/옵저버빌리티
  - `API_BASE_URL`, `MCP_SERVER_URL`, `LANGCHAIN_API_KEY`
  - Langfuse: `LANGFUSE_HOST`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`

</details>

<a id="secret-key"></a>
### 🔑 SECRET_KEY 생성

```bash
openssl rand -hex 32
```

<a id="start-services"></a>
### ▶️ 서비스 시작

```bash
docker compose up -d
```

서비스 시작 후:
1. Jenkins 설정 파일이 자동으로 복사됩니다
2. 모든 서비스가 시작됩니다
3. Jenkins 초기화를 위해 약 90초 대기합니다
4. Jenkins API 토큰을 생성하고 `.env` 파일을 업데이트합니다

<a id="service-status"></a>
### ✅ 서비스 상태 확인

```bash
docker compose ps
```

<a id="access"></a>
### 🌐 접속 정보

- Frontend: http://localhost
- Backend API: http://localhost:3000
- Backend API 문서: http://localhost:3000/docs
- Jenkins: http://localhost:10218
- PostgreSQL: localhost:5433

<a id="jenkins-login"></a>
### 🔐 Jenkins 로그인

- URL: http://localhost:10218
- 사용자명: admin
- 비밀번호: admin123 (`.env`에서 설정한 값)


<a id="database"></a>
## 🐘 데이터베이스

### 🐘 PostgreSQL (메인 데이터베이스)

기본 설정:
- 호스트: localhost
- 포트: 5433
- 데이터베이스: postdb
- 사용자명: admin
- 비밀번호: `.env` 파일에서 설정

접속:

<details>
<summary><b>접속 명령어 보기</b></summary>

```bash
# 호스트에서 접속
psql -h localhost -p 5433 -U admin -d postdb

# 컨테이너에서 접속
docker compose exec postgres psql -U admin -d postdb
```

</details>

### 🔁 데이터베이스 선택

Backend에서 사용할 데이터베이스 접속 정보는 `.env` 파일의 `DB_*` 환경 변수로 설정합니다.

<details>
<summary><b>예시 (PostgreSQL)</b></summary>

```bash
DB_ENGINE=postgresql
DB_HOST=postgres
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=admin123
DB_NAME=postdb
```

</details>

<a id="api-docs"></a>
## 🧾 API 문서

Backend API는 Swagger UI를 통해 확인할 수 있습니다.

- Swagger UI: http://localhost:3000/docs
- ReDoc: http://localhost:3000/redoc

### 🧭 주요 API 엔드포인트

<details>
<summary><b>엔드포인트 목록 보기</b></summary>

인증:
- POST `/api/auth/signup` - 회원가입
- POST `/api/auth/login` - 로그인
- GET `/api/auth/me` - 현재 사용자 정보
- POST `/api/auth/logout` - 로그아웃

프로젝트:
- GET `/api/projects` - 프로젝트 목록
- POST `/api/projects` - 프로젝트 생성
- GET `/api/projects/{id}` - 프로젝트 상세
- PUT `/api/projects/{id}` - 프로젝트 수정
- DELETE `/api/projects/{id}` - 프로젝트 삭제

스캔:
- POST `/api/projects/{id}/scans/trigger` - 스캔 트리거
- GET `/api/projects/{id}/scans` - 스캔 목록
- GET `/api/projects/{id}/scans/{scan_id}` - 스캔 상세
- GET `/api/projects/{id}/scans/{scan_id}/vulnerabilities` - 취약점 목록

팀:
- GET `/api/teams/my` - 내 팀 목록
- GET `/api/teams/{id}` - 팀 상세
- POST `/api/teams/{id}/members` - 팀 멤버 추가
- DELETE `/api/teams/{id}/members/{user_id}` - 팀 멤버 제거

</details>

<a id="jenkins-integration"></a>
## 🤖 Jenkins 통합

### 🛠️ 자동 설정

Jenkins는 컨테이너 시작 시 **JCasC**로 기본 설정을 적용하고, Backend가 프로젝트/스캔 요청에 따라 **Pipeline Job을 생성/업데이트 후 트리거**합니다.

- 설정: `jenkins/jenkins.yaml`
- 파이프라인: `jenkins/Jenkinsfile`

### 🔄 스캔 프로세스

<details>
<summary><b>프로세스 보기</b></summary>

1. 사용자가 Frontend에서 스캔 요청
2. Backend가 Jenkins Job 트리거
3. Jenkins가 GitHub에서 소스코드 클론 또는 업로드 파일 사용
4. (선택) Semgrep SAST 실행
5. LLM API로 취약점 분석
6. 결과를 Backend로 콜백
7. Backend가 결과를 데이터베이스에 저장
8. 사용자가 Frontend에서 결과 확인

</details>

### ⚙️ Jenkins Job 파라미터

<details>
<summary><b>파라미터 목록 보기</b></summary>

- `SOURCE_TYPE`: `git` 또는 `upload`
- `GITHUB_URL`: 분석할 GitHub 저장소 URL (`SOURCE_TYPE=git`)
- `UPLOADED_FILE_PATH`: 업로드된 ZIP 파일 경로 (`SOURCE_TYPE=upload`)
- `PROJECT_NAME`: 프로젝트 이름
- `SCAN_TYPE`: 스캔 타입 (ALL, SSRF, RCE, XSS, SQLi, IDOR, PATH_TRAVERSAL, AUTH)
- `API_PROVIDER`: LLM API 제공자 (예: groq, openai 등)
- `MODEL`: LLM 모델 (예: gpt-4o 등)
- `RUN_SAST`: Semgrep SAST 실행 여부
- `SCAN_MODE`: `custom`(Full) / `preset`(Quick)
- `PROFILE_MODE`: `preset` / `custom`
- `PROJECT_ID`: L2VE project_id
- `SCAN_ID`: L2VE scan_id
- `TRIGGER_MODE`: `web` / `git`
- `API_BASE`: L2VE 백엔드 API Base (기본: `http://backend:3000/api`)
- `BACKEND_SERVICE_API_KEY`: 백엔드 고정 API Key
- `JENKINS_CALLBACK_SECRET`: 백엔드 콜백 시크릿
- `LLM_ENDPOINT_URL`: 옵션: 커스텀 LLM 엔드포인트 URL
- `LLM_API_KEY`: 옵션: 커스텀 LLM API Key/Token
- `SEED_FILE_PATH`: Quick mode verifier seed file path
- `AWS_BEDROCK_RPM`: Bedrock 요청 제한(분당)
- `AWS_BEDROCK_TPM`: Bedrock 토큰 제한(분당)
- `NOTIFY_EMAILS`: 스캔 완료/실패 알림 수신자(콤마 구분)

</details>

<a id="troubleshooting"></a>
## 🧯 문제 해결

### ⚔️ 포트 충돌

포트가 이미 사용 중인 경우:

<details>
<summary><b>명령어 보기</b></summary>

```bash
# 사용 중인 포트 확인
sudo lsof -i :80
sudo lsof -i :3000
sudo lsof -i :5433
sudo lsof -i :10218

# 프로세스 종료
sudo kill -9 [PID]
```

</details>

### 🧱 컨테이너 시작 실패

<details>
<summary><b>명령어 보기</b></summary>

```bash
# 로그 확인
docker compose logs

# 특정 서비스 로그 확인
docker compose logs backend
docker compose logs jenkins

# 서비스 재시작
docker compose down
docker compose up -d
```

</details>

### 🗄️ 데이터베이스 연결 실패

<details>
<summary><b>명령어 보기</b></summary>

```bash
# 데이터베이스 로그 확인
docker compose logs postgres

# 데이터베이스 상태 확인
docker compose ps

# Backend 재시작
docker compose restart backend
```

</details>

### 🔑 Jenkins API 토큰 문제

<details>
<summary><b>명령어 보기</b></summary>

```bash
# Jenkins API 토큰 재생성
bash scripts/setup-jenkins-token.sh

# Backend 재시작
docker compose restart backend
```

</details>

### 💾 디스크 공간 부족

<details>
<summary><b>명령어 보기</b></summary>

```bash
# 사용하지 않는 Docker 리소스 정리
docker system prune -a

# 볼륨 확인
docker volume ls

# 불필요한 볼륨 삭제 (주의)
docker volume rm [VOLUME_NAME]
```

</details>

<a id="development"></a>
## 🧑‍💻 개발

### 🧠 Backend 개발

<details>
<summary><b>명령어 보기</b></summary>

```bash
# Backend 컨테이너 접속
docker compose exec backend bash

# 의존성 설치
pip install -r requirements.txt

# 개발 서버 실행
uvicorn app.main:app --reload --host 0.0.0.0 --port 3000
```

</details>

### 🎨 Frontend 개발

<details>
<summary><b>명령어 보기</b></summary>

```bash
# Frontend 컨테이너 접속
docker compose exec frontend sh

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

</details>

### 💻 로컬 개발 (컨테이너 없이)

<details>
<summary><b>명령어 보기</b></summary>

Backend:
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

</details>

<a id="backup-restore"></a>
## ♻️ 백업 및 복구

### 📦 데이터베이스 백업

<details>
<summary><b>명령어 보기</b></summary>

```bash
# PostgreSQL 백업
mkdir -p ./data/postgres-backups
timestamp=$(date +%Y%m%d_%H%M%S)
docker exec l2ve-postgres pg_dump -U admin postdb > ./data/postgres-backups/backup_${timestamp}.sql

# 백업 파일 위치
# data/postgres-backups/
```

</details>

### ♻️ 데이터베이스 복구

PostgreSQL:
<details>
<summary><b>명령어 보기</b></summary>

```bash
cat ./data/postgres-backups/backup_20250101_120000.sql | docker exec -i l2ve-postgres psql -U admin postdb
```

</details>

<a id="security"></a>
## 🛡️ 보안

### 👤 인증 및 권한

- JWT 기반 인증
- 3단계 권한 구조 (Superuser, Team Manager, Member)
- IDOR (Insecure Direct Object Reference) 방지
- Rate Limiting

### 🔒 데이터 보안

- 비밀번호 bcrypt 해싱
- SQL Injection 방지 (SQLAlchemy ORM)
- XSS 방지 (Bleach)
- Security Headers

### 🔐 API 보안

- Rate Limiting (SlowAPI)
- Input Validation (Pydantic)
- Jenkins Callback 인증 (Shared Secret)

<a id="monitoring"></a>
## 📈 모니터링

### ❤️ 헬스체크

<details>
<summary><b>명령어 보기</b></summary>

```bash
# 개별 서비스 확인
curl http://localhost:3000/health  # Backend
curl http://localhost/health       # Frontend
```

</details>

### 🧮 리소스 사용량

<details>
<summary><b>명령어 보기</b></summary>

```bash
docker stats
```

</details>

<a id="deployment"></a>
## 🚚 배포

### 🏁 프로덕션 배포

1. `.env` 파일의 모든 환경 변수 확인
2. `SECRET_KEY` 생성 및 설정
3. 데이터베이스 비밀번호 변경
4. Jenkins 비밀번호 변경
5. API 키 설정 (GROQ, OpenAI)
6. `docker compose up -d` 실행

### ✅ 환경 변수 체크리스트

<details>
<summary><b>필수 환경 변수</b></summary>

- Database
  - Postgres 컨테이너: `POSTGRES_PASSWORD` (필수 변경 권장)
  - Backend DB 연결: `DB_ENGINE`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Backend 인증
  - `SECRET_KEY`
- Jenkins 연동
  - `JENKINS_URL`, `JENKINS_ADMIN_USER`, `JENKINS_ADMIN_PASSWORD`
  - `JENKINS_USER`, `JENKINS_API_TOKEN`, `JENKINS_GIT_CREDENTIALS_ID`
  - `JENKINS_CALLBACK_SECRET`, `BACKEND_SERVICE_API_KEY`, `BACKEND_API_BASE`
  - `GITHUB_USERNAME`, `GITHUB_TOKEN`
- LLM
  - `GROQ_API_KEY` 또는 `OPENAI_API_KEY` (또는 `OPENROUTER_API_KEY`)

옵션:
- Bedrock: `AWS_BEARER_TOKEN_BEDROCK`, `BEDROCK_AWS_REGION`
- SMTP 알림: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`
- Langfuse: `LANGFUSE_HOST`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`

</details>

<a id="license"></a>
## 📄 라이선스

이 프로젝트의 라이선스 정보는 프로젝트 루트의 LICENSE 파일을 참조하세요.

<a id="contributing"></a>
## 🤝 기여

이슈나 개선 사항이 있으면 Issue를 등록하거나 Pull Request를 제출해주세요.

<a id="documents"></a>
## 📚 문서

추가 문서:
- `PROJECT_DESIGN.md`: 프로젝트 설계 문서
- `L2VE-ARCHITECTURE.md`: 아키텍처 다이어그램
- `scripts/README.md`: 스크립트 사용법
## Credits

- **남지우** — https://github.com/J1vvoo
- **박영주** — https://github.com/YoungJ00
- **이재훈** — https://github.com/jaehoon0905
- **이진규** - https://github.com/Jggyu
- **임형천** - https://github.com/Limguri

## Acknowledgements

본 확장 프로그램은 대한민국 과학기술정보통신부의 재원으로 한국인터넷진흥원이 주관하는 차세대 보안리더 양성 프로그램(Best of the Best) 14기 보안 컨설팅 L2VE 팀 프로젝트의 산출물 일부로 개발되었습니다.

<a id="version"></a>
## 🏷️ 버전

- 버전: 1.1
- 최종 업데이트: 2025-12-19
  
<a id="GuideLine"></a>
## 📘 LLM 기반 취약점 분석 가이드라인

본 프로젝트와 함께, LLM을 활용한 소스코드 취약점 탐지 방법론을 정리한 가이드라인 문서를 제공합니다.
본 문서에서는 기존 SAST 도구의 한계와 LLM 기반 분석에서 발생하는 미탐지 및 오탐지 원인을 분석하고, 이를 개선하기 위한 Taint Flow 인식 기반의 Multi-Agent 분석 구조를 제안합니다.

👉 **PDF 다운로드**: [AI 활용 소스코드 취약점 관리를 위한 가이드라인](https://github.com/L2VE/L2VE/releases/download/guideline/AI._.pdf)




---

⬆️ [맨 위로](#top)
