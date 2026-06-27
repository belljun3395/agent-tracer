import "reflect-metadata";
import { initializeTransactionalContext } from "typeorm-transactional";
import type express from "express";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

initializeTransactionalContext();
import { AppModule } from "../presentation/app.module.js";
import { setupSwagger } from "../presentation/swagger.js";
import { AppConfigService } from "~config/app-config.service.js";
import { loadApplicationConfig } from "~config/application-config.js";
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
    // 알림은 Redis pub/sub 으로 흐른다: 발행자는 대상 userId 와 함께 채널에 publish 하고,
    // 구독자가 이 파드의 해당 사용자 소켓으로 fan-out 한다(멀티파드/무상태). WS edge와
    // Redis 수명주기는 ws-gateway 의 WsGateway 가 소유한다. notifier 는 Nest 앱 생성
    // 전에 만들어져 NOTIFICATION_PUBLISHER 로 주입된다.
    const redisUrl = loadApplicationConfig().redis.url;
    const wsGateway = await WsGateway.create(redisUrl);

    const nestApp = await NestFactory.create<NestExpressApplication>(
        AppModule.forRoot({ notifier: wsGateway.notifier }),
        { logger: ["error", "warn"] },
    );
    // Security headers on every response. CSP is disabled because this gateway
    // serves the Swagger UI (inline scripts/styles) and no other HTML — the rest
    // of helmet's defaults (HSTS, X-Content-Type-Options, frameguard, …) apply.
    nestApp.use(helmet({ contentSecurityPolicy: false }));
    // CORS. Same-origin requests and native clients (no Origin header, e.g. the
    // runtime daemon / curl) are always allowed; browser origins are restricted
    // to loopback for local dashboards. Set MONITOR_CORS_ALLOW_ANY_ORIGIN=1 for
    // an intentionally network-exposed UI. Mirrors the WS upgrade origin policy.
    nestApp.enableCors({
        origin: (origin, callback) => callback(null, isHttpOriginAllowed(origin)),
        credentials: true,
    });
    // Resolved once from the DI-managed config so the listen address and startup
    // banner come from the same source the rest of the app reads.
    const appConfig = nestApp.get(AppConfigService);
    const pg = appConfig.postgres;
    const listen = {
        host: appConfig.resolveListenHost(),
        port: appConfig.resolvePort(),
        publicBaseUrl: appConfig.resolveHttpBaseUrl(),
        database: `postgres://${pg.host}:${pg.port}/${pg.database}`,
    };
    setupSwagger(nestApp);
    // Raise the body limit above Express's 100kb default: a 100-event batch with
    // real tool output (Bash results, file contents) easily exceeds it and would
    // otherwise be rejected at the parser.
    nestApp.useBodyParser("json", { limit: "8mb" });
    nestApp.useBodyParser("urlencoded", { limit: "8mb", extended: true });
    const app = nestApp.getHttpAdapter().getInstance() as ReturnType<typeof express>;
    configureTrustedProxy(app);
    const server = nestApp.getHttpServer();

    const taskSnapshots = nestApp.get<ITaskSnapshotQuery>(TASK_SNAPSHOT_QUERY);
    wsGateway.attach(server, {
        // Browsers do NOT enforce same-origin for WebSocket, so without a check
        // any page the user visits could open /ws and read the live event stream
        // (task titles, workspace paths). Allow native clients (no Origin header)
        // and loopback origins; gate everything else behind an explicit opt-in.
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
        // 연결마다 그 사용자 범위(runWithUser)에서 초기 스냅샷을 만든다(사용자별 데이터
        // + 무상태). 라이브 업데이트는 fan-out 으로 온다.
        buildSnapshot: (userId) => runWithUser(userId, () => taskSnapshots.buildDashboardSnapshot()),
        onError: (message) => process.stderr.write(`[nestjs-server] ${message}\n`),
    });

    // OnApplicationBootstrap 훅(예: task 모듈의 server-sdk reaper)이 여기서 발화한다.
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

/**
 * WebSocket upgrade origin policy. Native clients (the runtime daemon, curl)
 * send no Origin header and are always allowed; browser connections are
 * restricted to loopback origins to block cross-site WebSocket hijacking.
 * Set MONITOR_WS_ALLOW_ANY_ORIGIN=1 for an intentionally network-exposed
 * dashboard served from a non-loopback host.
 */
function isWsOriginAllowed(origin: string | undefined): boolean {
    if (process.env.MONITOR_WS_ALLOW_ANY_ORIGIN === "1") return true;
    if (!origin) return true;
    try {
        const host = new URL(origin).hostname;
        return host === "localhost" || host === "127.0.0.1" || host === "::1";
    } catch {
        return false;
    }
}

/**
 * HTTP CORS origin policy. Mirrors the WS upgrade policy: same-origin requests
 * and native clients (no Origin header) are always allowed; browser origins are
 * restricted to loopback unless MONITOR_CORS_ALLOW_ANY_ORIGIN=1 opts a
 * network-exposed deployment into reflecting any origin.
 */
function isHttpOriginAllowed(origin: string | undefined): boolean {
    if (process.env.MONITOR_CORS_ALLOW_ANY_ORIGIN === "1") return true;
    if (!origin) return true;
    try {
        const host = new URL(origin).hostname;
        return host === "localhost" || host === "127.0.0.1" || host === "::1";
    } catch {
        return false;
    }
}

/** WS 연결 URL 쿼리에서 userId 를 추출한다(없으면 기본 사용자). */
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
