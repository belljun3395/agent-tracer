#!/bin/bash
set -e

# 루트 디렉토리로 이동하여 실행 보장
cd "$(dirname "$0")/.."

echo "🚀 Agent Tracer Docker 환경을 시작합니다..."

# Mac 등 특정 환경의 buildx 권한 꼬임 방지
rm -rf ~/.docker/buildx/activity/* 2>/dev/null || true

# 빌드 및 백그라운드 실행
docker compose up -d --build

echo ""
echo "✅ 실행 완료!"
echo "🌐 웹 UI(Frontend) 접속: http://localhost:5173"
echo "🛠 API 서버(Backend): http://localhost:3847 (내부 통신용)"
echo ""
echo "실시간 로그를 확인하려면 아래 명령을 사용하세요:"
echo "  docker compose logs -f"
