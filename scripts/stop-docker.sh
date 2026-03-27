#!/bin/bash
set -e

# 루트 디렉토리로 이동
cd "$(dirname "$0")/.."

echo "🛑 Agent Tracer Docker 환경을 종료합니다..."

# 컨테이너 종료 (리소스는 유지, 네트워크는 제거)
docker compose down

echo "✅ 컨테이너가 성공적으로 종료되었습니다."
