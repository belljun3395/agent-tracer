#!/bin/bash
set -e

# 루트 디렉토리로 이동하여 실행 보장
cd "$(dirname "$0")/.."

echo "🚀 Agent Tracer Docker 환경을 시작합니다..."

# Mac 등 특정 환경의 buildx 권한 꼬임 방지
rm -rf ~/.docker/buildx/activity/* 2>/dev/null || true

# 로컬 단일 플랫폼 이미지에는 provenance/SBOM 매니페스트가 불필요 → export 오버헤드 제거
export BUILDX_NO_DEFAULT_ATTESTATIONS=1

# 기본은 변경분만 빌드(레이어 캐시) 후 기동한다.
# 코드/의존성이 안 바뀐 게 확실하면 빌드를 건너뛰어 즉시 기동: ./scripts/start-docker.sh --no-build
if [ "$1" = "--no-build" ]; then
  docker compose up -d
else
  docker compose build
  docker compose up -d
fi

echo ""
echo "✅ 실행 완료!"
echo "🌐 웹 UI(Frontend) 접속: http://localhost:5173"
echo "🛠 API 서버(Backend): http://localhost:3847 (내부 통신용)"
echo ""
echo "실시간 로그를 확인하려면 아래 명령을 사용하세요:"
echo "  docker compose logs -f"
