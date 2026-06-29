# syntax=docker/dockerfile:1

# ---- 공유 의존성 베이스: monorepo 전체를 한 번만 설치한다 ----
# (gateway 와 web 두 이미지가 동일한 npm ci 레이어를 공유한다)
FROM node:25-slim AS deps

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
COPY packages/runtime/package.json packages/runtime/
COPY packages/web/package.json packages/web/

# 의존성은 모두 prebuilt 네이티브 바이너리(@swc/core·esbuild 등)라 gcc 빌드툴이 필요 없다.
# swc-node 로더(@swc-node/register, @swc/core)가 런타임/빌드에 필요하므로 dev 도 설치한다
# (NODE_ENV=production 이면 npm 이 dev 를 생략하므로 --include=dev 를 명시).
# --mount=type=cache 로 npm 다운로드 캐시를 빌드 간에 재사용한다.
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev

COPY . .

# ---- API 게이트웨이: swc-node 로더로 소스(TS)에서 직접 실행 ----
# (esbuild 번들은 NestJS 의 emitDecoratorMetadata 를 지원하지 않아 DI 가 깨진다)
FROM deps AS gateway
ENV SWC_NODE_PROJECT=packages/server/api-gateway/tsconfig.dev.json
EXPOSE 3847
CMD ["node", "--conditions=development", "--import", "file:///app/scripts/register-swc.mjs", "packages/server/api-gateway/src/gateway.entry.ts"]

# ---- 웹 정적 자산 빌드 ----
FROM deps AS web-builder
RUN npm run build --workspace=@monitor/web

FROM nginx:alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-builder /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
