# Jenkins API 토큰 자동화 스크립트

이 디렉토리에는 Jenkins API 토큰을 자동으로 생성하고 설정하는 스크립트가 포함되어 있습니다.

## 스크립트 설명

### 1. `generate-jenkins-token.py`
- **목적**: Jenkins REST API를 사용하여 API 토큰을 생성
- **사용법**: Jenkins가 실행 중일 때 호스트에서 실행
- **요구사항**: Python 3, `requests` 라이브러리

```bash
# 설치
pip install requests

# 실행
python3 scripts/generate-jenkins-token.py
```

### 2. `setup-jenkins-token.sh`
- **목적**: Jenkins API 토큰을 생성하고 `.env` 파일에 자동으로 업데이트
- **사용법**: 
  ```bash
  make jenkins-token
  # 또는
  bash scripts/setup-jenkins-token.sh
  ```

## 동작 방식

1. **Jenkins 초기화 시** (`jenkins/init.groovy.d/02-generate-api-token.groovy`)
   - Jenkins가 시작되면 Groovy 스크립트가 자동으로 실행
   - Admin 사용자의 API 토큰을 생성하고 `/var/jenkins_home/api_token.txt`에 저장

2. **토큰 설정 스크립트** (`scripts/setup-jenkins-token.sh`)
   - Python 스크립트를 사용하여 REST API로 토큰 생성 시도
   - 또는 Groovy 스크립트가 생성한 토큰 파일 사용
   - 생성된 토큰을 `.env` 파일에 자동 업데이트

3. **자동화** (`Makefile`)
   - `make up` 실행 시 자동으로 토큰 생성 및 설정
   - `make jenkins-token`으로 수동 재생성 가능

## 문제 해결

### Python/requests가 설치되지 않은 경우
```bash
# Ubuntu/Debian
sudo apt-get install python3-pip
pip3 install requests

# macOS
brew install python3
pip3 install requests
```

### 토큰 생성 실패 시
1. Jenkins 로그 확인:
   ```bash
   docker logs l2ve-jenkins
   ```

2. Jenkins가 완전히 시작되었는지 확인:
   ```bash
   curl http://localhost:10218/login
   ```

3. 수동으로 토큰 생성:
   - Jenkins 웹 UI (http://localhost:10218)에 로그인
   - 사용자 설정 → API 토큰 → 토큰 생성
   - 생성된 토큰을 `.env` 파일에 추가

