# Agent Tracer Docker 가이드

본 문서는 `agent-tracer`를 로컬에서 상시 실행하기 위해 제공되는 Docker 환경 사용 가이드입니다. 

기본적으로 `docker-compose.yml`을 사용하여 Backend(Server)와 Frontend(Web)가 각각의 컨테이너로 띄워지며 연결됩니다.

## 🚀 빠른 시작 (Quick Start)

터미널에서 프로젝트 루트 디렉토리(`./`) 상태로 다음 명령어를 실행합니다.

```sh
# 이미지 빌드 및 백그라운드에서 컨테이너 실행
docker compose up -d --build
```

실행이 완료되면 아래 URL을 통해 접속할 수 있습니다:
- **웹 UI (Frontend):** [http://localhost:5173](http://localhost:5173)
- **문서 (VitePress):** [http://localhost:5173/docs/](http://localhost:5173/docs/)
- **API 서버 (Backend):** `http://localhost:3847` 에서 내부적으로 통신 중입니다.

문서는 별도 컨테이너를 추가로 띄우지 않고, 기존 `web` 컨테이너 안에서 `/docs/` 경로로 함께 서빙됩니다.

---

## 🛑 도커 종료 및 관리

**컨테이너 중지**
```sh
docker compose stop
```

**컨테이너 완전 종료 및 리소스 삭제**
(단, 마운트된 데이터 볼륨은 삭제되지 않습니다)
```sh
docker compose down
```

**앱 로그 확인하기**
실시간 로그가 궁금하신 경우 아래 명령을 사용하세요.
```sh
# 전체 로그 확인
docker compose logs -f

# 특정 컨테이너(웹 또는 서버) 로그만 확인
docker compose logs -f web
docker compose logs -f server
```

---

## 💾 데이터 보존 (Volumes)

이 Docker 설정은 `.monitor` 폴더 내부의 데이터베이스(`monitor.sqlite`)를 보존하기 위해 `monitor-data`라는 이름의 로컬 Docker Volume을 사용합니다. 컨테이너를 삭제하고 다시 띄워도 Tracer 데이터는 안전하게 유지됩니다. 

만약 저장된 데이터를 완전히 초기화하고 싶다면 다음 명령어를 사용하세요.

```sh
# 주의: 이 명령어는 저장된 모든 데이터를 삭제합니다!
docker compose down -v
```

---

## 🛠 문제 해결 (Troubleshooting)

1. **`buildx ... operation not permitted` 에러 발생 시**
   Mac의 경우 종종 `.docker/buildx`의 쓰기 권한이 꼬여서 발생할 수 있습니다.
   해결 방법: 터미널에서 `rm -rf ~/.docker/buildx/activity/*` 명령어를 실행 한 후 다시 시도해보세요.

2. **포트 충돌 에러 (Port is already allocated)**
   `5173` (웹) 또는 `3847` (서버) 포트가 이미 사용 중인지 확인하세요.
   사용 중인 프로세스를 종료하거나 `docker-compose.yml` 파일에서 `ports:` 설정을 다른 포트로 변경해주세요.
