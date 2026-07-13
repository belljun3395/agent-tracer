# syntax=docker/dockerfile:1

# ---- LangGraph 에이전트 서비스: uv로 의존성 설치 후 소스 실행 ----
FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1
WORKDIR /app

# uv 바이너리만 복사해 온다(빌드 캐시 친화적).
COPY --from=ghcr.io/astral-sh/uv:0.10 /uv /usr/local/bin/uv

# 의존성 레이어: 매니페스트만 먼저 복사해 소스 변경이 재설치를 유발하지 않게 한다.
COPY pyproject.toml ./
COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv uv pip install --system --no-cache .

EXPOSE 8800
CMD ["python", "-m", "agent_graph"]
