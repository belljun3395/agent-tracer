# syntax=docker/dockerfile:1

# ---- 매니페스트 베이스: package.json 레이어만 먼저 복사해 npm ci 를 캐싱한다 ----
FROM node:24-slim AS deps-base

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/server/api-gateway/package.json packages/server/api-gateway/
COPY packages/server/shared/package.json packages/server/shared/
COPY packages/server/timeline-api/package.json packages/server/timeline-api/
COPY packages/server/run-api/package.json packages/server/run-api/
COPY packages/server/rules-api/package.json packages/server/rules-api/
COPY packages/server/insight-api/package.json packages/server/insight-api/
COPY packages/server/identity-api/package.json packages/server/identity-api/
COPY packages/server/ws-gateway/package.json packages/server/ws-gateway/
COPY packages/server/temporal-worker/package.json packages/server/temporal-worker/
COPY packages/runtime/package.json packages/runtime/
COPY packages/web/package.json packages/web/

# 의존성은 모두 prebuilt 네이티브 바이너리(@swc/core·esbuild 등)라 gcc 빌드툴이 필요 없다.

# ---- 런타임 의존성: gateway/temporal-worker 는 dev 툴체인(vitest·eslint·knip 등) 없이 뜬다 ----
# swc-node 로더(@swc-node/register, @swc/core, typescript)는 이 소스실행 모델의
# 실제 런타임 요구사항이라 각 package.json 의 dependencies 로 선언돼 있다 — 그래서
# --omit=dev 로도 함께 설치된다.
FROM deps-base AS runtime-deps
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev
COPY . .

# ---- 빌드 의존성: web 정적 자산 빌드에는 vite 등 devDependencies 가 필요하다 ----
# (NODE_ENV=production 이면 npm 이 dev 를 생략하므로 --include=dev 로 되살린다)
FROM deps-base AS build-deps
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev
COPY . .

# ---- API 게이트웨이: swc-node 로더로 소스(TS)에서 직접 실행 ----
# (esbuild 번들은 NestJS 의 emitDecoratorMetadata 와 여러 CJS 상호운용을 지원하지 않아 DI/require 가 깨진다)
FROM runtime-deps AS gateway
ENV SWC_NODE_PROJECT=packages/server/api-gateway/tsconfig.dev.json
EXPOSE 3847
CMD ["node", "--conditions=development", "--import", "file:///app/scripts/register-swc.mjs", "packages/server/api-gateway/src/gateway.entry.ts"]

# ---- Temporal 워커: swc-node 로더로 소스(TS)에서 직접 실행 ----
FROM runtime-deps AS temporal-worker
ENV SWC_NODE_PROJECT=packages/server/temporal-worker/tsconfig.json
CMD ["node", "--conditions=development", "--import", "file:///app/scripts/register-swc.mjs", "packages/server/temporal-worker/src/worker.entry.ts"]

# ---- 웹 정적 자산 빌드 ----
FROM build-deps AS web-builder
RUN npm run build --workspace=@monitor/web

FROM nginx:alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-builder /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
