# syntax=docker/dockerfile:1

# ---- 매니페스트 베이스: package.json 레이어만 먼저 복사해 npm ci를 캐싱한다 ----
FROM node:24-slim AS deps-base

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/kernel/package.json packages/kernel/
COPY packages/server/libs/platform/package.json packages/server/libs/platform/
COPY packages/server/libs/tracer-domain/package.json packages/server/libs/tracer-domain/
COPY packages/server/apps/runtime-api/package.json packages/server/apps/runtime-api/
COPY packages/server/apps/tracer-api/package.json packages/server/apps/tracer-api/
COPY packages/server/apps/projector/package.json packages/server/apps/projector/
COPY packages/server/apps/ai-agent-worker/package.json packages/server/apps/ai-agent-worker/
COPY packages/runtime/package.json packages/runtime/
COPY packages/web/package.json packages/web/

# 의존성이 모두 사전 빌드된 네이티브 바이너리라 gcc 빌드툴이 필요 없다.

# ---- 의존성 설치 1회: 전체(dev 포함)를 한 번만 깐다 ----
# web 정적 자산 빌드가 vite 등 devDependencies를 요구하므로 전체를 설치한다.
FROM deps-base AS deps
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev

# ---- 프로덕션 node_modules 산출: dev 툴체인을 걷어낸다 ----
FROM deps AS pruned-deps
RUN --mount=type=cache,target=/root/.npm npm prune --omit=dev

# ---- 런타임 의존성 ----
# swc-node 로더는 이 소스실행 모델의 런타임 요구사항이라 prune 후에도 각 package.json에 남는다.
FROM deps-base AS runtime-deps
COPY --from=pruned-deps /app/node_modules ./node_modules
COPY tsconfig.base.json tsconfig.paths.json application*.yaml ./
COPY scripts/register-otel.mjs scripts/
COPY packages/kernel packages/kernel
COPY packages/server packages/server

# ---- 빌드 의존성: web 정적 자산 빌드에는 전체 설치가 그대로 필요하다 ----
FROM deps AS build-deps
COPY tsconfig.base.json tsconfig.paths.json ./
COPY packages/kernel packages/kernel
COPY packages/web packages/web

# ---- migrate: tracer·runtime DB 마이그레이션을 실행하고 종료하는 원샷 컨테이너 ----
FROM runtime-deps AS migrate
COPY scripts/grant-agent-reader.mjs scripts/
CMD ["npm", "run", "migrate:all"]

# ---- runtime-api: swc-node 로더로 소스에서 직접 실행 ----
FROM runtime-deps AS runtime-api
ENV SWC_NODE_PROJECT=packages/server/apps/runtime-api/tsconfig.json
EXPOSE 3901
CMD ["node", "--conditions=development", "--import", "file:///app/scripts/register-otel.mjs", "--import", "@swc-node/register/esm-register", "packages/server/apps/runtime-api/src/main.ts"]

# ---- tracer-api: swc-node 로더로 소스에서 직접 실행 ----
FROM runtime-deps AS tracer-api
ENV SWC_NODE_PROJECT=packages/server/apps/tracer-api/tsconfig.json
EXPOSE 3902
CMD ["node", "--conditions=development", "--import", "file:///app/scripts/register-otel.mjs", "--import", "@swc-node/register/esm-register", "packages/server/apps/tracer-api/src/main.ts"]

# ---- chat-agent-worker: chat Temporal workflow/activity 전용 프로세스 ----
FROM tracer-api AS chat-agent-worker
CMD ["node", "--conditions=development", "--import", "file:///app/scripts/register-otel.mjs", "--import", "@swc-node/register/esm-register", "packages/server/apps/tracer-api/src/chat.worker.main.ts"]

# ---- projector: Kafka 컨슈머이며 swc-node 로더로 소스에서 직접 실행 ----
FROM runtime-deps AS projector
ENV SWC_NODE_PROJECT=packages/server/apps/projector/tsconfig.json
EXPOSE 3903
CMD ["node", "--conditions=development", "--import", "file:///app/scripts/register-otel.mjs", "--import", "@swc-node/register/esm-register", "packages/server/apps/projector/src/main.ts"]

# ---- ai-agent-worker: swc-node 로더로 소스에서 직접 실행 ----
FROM runtime-deps AS ai-agent-worker
ENV SWC_NODE_PROJECT=packages/server/apps/ai-agent-worker/tsconfig.json
CMD ["node", "--conditions=development", "--import", "file:///app/scripts/register-otel.mjs", "--import", "@swc-node/register/esm-register", "packages/server/apps/ai-agent-worker/src/main.ts"]

# ---- 웹 정적 자산 빌드 ----
FROM build-deps AS web-builder
RUN npm run build --workspace=@monitor/web

FROM nginx:alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-builder /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
