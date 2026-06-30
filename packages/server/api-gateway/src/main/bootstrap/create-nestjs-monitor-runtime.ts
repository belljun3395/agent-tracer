import "reflect-metadata";
import { initializeTransactionalContext } from "typeorm-transactional";
import type express from "express";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

initializeTransactionalContext();
import { AppModule } from "../presentation/app.module.js";
import { setupSwagger } from "../presentation/swagger.js";
import { AppConfigService } from "@monitor/server-core/config/app-config.service.js";
import { loadApplicationConfig } from "@monitor/server-core/config/application-config.js";
import { runWithUser, DEFAULT_USER_ID } from "@monitor/shared/kernel/user/user.context.js";
import { WsGateway } from "@monitor/ws-gateway/ws/ws.gateway.js";
import {
    assignRequestContext,
    configureTrustedProxy,
    createUpgradeRequestContext,
    logHttpUpgrade,
    type RequestContextIncomingMessage,
} from "../presentation/middleware/request-context.js";
import type { ITaskSnapshotQuery } from "@monitor/run-api/task/public/iservice/task.snapshot.query.iservice.js";
import { TASK_SNAPSHOT_QUERY } from "@monitor/run-api/task/public/tokens.js";
import type { MonitorRuntime } from "./runtime.type.js";

export async function createNestMonitorRuntime(): Promise<MonitorRuntime> {
    const redisUrl = loadApplicationConfig().redis.url;
    const wsGateway = await WsGateway.create(redisUrl);

    const nestApp = await NestFactory.create<NestExpressApplication>(
        AppModule.forRoot({ notifier: wsGateway.notifier }),
        { logger: ["error", "warn"] },
    );

    // Swagger UI만 HTML을 제공하므로 CSP는 끄고 나머지 보안 헤더는 유지한다.
    nestApp.use(helmet({ contentSecurityPolicy: false }));

    // 브라우저 출처는 로컬 대시보드로 제한하고, Origin 없는 네이티브 클라이언트는 허용한다.
    nestApp.enableCors({
        origin: (origin, callback) => callback(null, isHttpOriginAllowed(origin)),
        credentials: true,
    });

    const appConfig = nestApp.get(AppConfigService);
    const pg = appConfig.postgres;
    const listen = {
        host: appConfig.resolveListenHost(),
        port: appConfig.resolvePort(),
        publicBaseUrl: appConfig.resolveHttpBaseUrl(),
        database: `postgres://${pg.host}:${pg.port}/${pg.database}`,
    };
    setupSwagger(nestApp);

    // 이벤트 배치에는 도구 출력이 포함되므로 기본 100kb보다 큰 본문을 허용한다.
    nestApp.useBodyParser("json", { limit: "8mb" });
    nestApp.useBodyParser("urlencoded", { limit: "8mb", extended: true });
    const app = nestApp.getHttpAdapter().getInstance() as ReturnType<typeof express>;
    configureTrustedProxy(app);
    const server = nestApp.getHttpServer();

    const taskSnapshots = nestApp.get<ITaskSnapshotQuery>(TASK_SNAPSHOT_QUERY);
    wsGateway.attach(server, {
        // WebSocket은 브라우저 동일 출처 정책이 적용되지 않으므로 업그레이드에서 직접 차단한다.
        acceptUpgrade: (pathname, request) =>
            pathname === "/ws" && isWsOriginAllowed(headerValue(request.headers["origin"])),
        onUpgradeAttempt: (request, pathname, accepted) => {
            const context = createUpgradeRequestContext(request);
            assignRequestContext(request as RequestContextIncomingMessage, context);
            const userAgent = headerValue(request.headers["user-agent"]);
            logHttpUpgrade({
                type: "http_upgrade",
                requestId: context.requestId,
                path: pathname,
                accepted,
                clientIp: context.clientIp,
                ...(userAgent ? { userAgent } : {}),
            });
        },
        resolveUserId: extractWsUserId,

        // 초기 스냅샷은 연결에서 해석한 사용자 범위 안에서만 만든다.
        buildSnapshot: (userId) => runWithUser(userId, () => taskSnapshots.buildDashboardSnapshot()),
        onError: (message) => process.stderr.write(`[nestjs-server] ${message}\n`),
    });

    await nestApp.init();
    return {
        server,
        listen,
        close: async () => {
            await nestApp.close();
            await wsGateway.close();
        },
    };
}

// WebSocket은 Origin 없는 런타임 클라이언트를 허용하고, 브라우저는 로컬 출처만 허용한다.
function isWsOriginAllowed(origin: string | undefined): boolean {
    if (process.env.MONITOR_WS_ALLOW_ANY_ORIGIN === "1") return true;
    return isLocalOriginAllowed(origin);
}

// HTTP도 WebSocket과 같은 출처 정책을 적용한다.
function isHttpOriginAllowed(origin: string | undefined): boolean {
    if (process.env.MONITOR_CORS_ALLOW_ANY_ORIGIN === "1") return true;
    return isLocalOriginAllowed(origin);
}

export function isLocalOriginAllowed(origin: string | undefined): boolean {
    if (!origin) return true;
    try {
        const host = new URL(origin).hostname;
        return isLoopbackHost(host);
    } catch {
        return false;
    }
}

function isLoopbackHost(host: string): boolean {
    const normalized = host.toLowerCase();
    return normalized === "localhost"
        || normalized === "127.0.0.1"
        || normalized === "::1"
        || normalized === "[::1]";
}

// userId가 없거나 URL을 파싱할 수 없으면 기본 사용자 범위로 연결한다.
function extractWsUserId(url: string | undefined): string {
    try {
        const parsed = new URL(url ?? "/", "http://localhost");
        return parsed.searchParams.get("userId")?.trim() || DEFAULT_USER_ID;
    } catch {
        return DEFAULT_USER_ID;
    }
}

function headerValue(raw: string | string[] | undefined): string | undefined {
    return Array.isArray(raw) ? raw[0] : raw;
}
