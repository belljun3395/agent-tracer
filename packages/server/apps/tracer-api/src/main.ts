import "reflect-metadata";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import {
    assertSchemaUpToDate,
    createDataSource,
    createKafka,
    loadApplicationConfig,
    SchemaOutOfDateError,
} from "@monitor/platform";
import { TRACER_ENTITIES } from "@monitor/tracer-domain";
import { TRACER_MIGRATIONS } from "@monitor/tracer-domain/migrations/registry.js";
import { errorMessage, logError, logInfo } from "~tracer-api/config/log.js";
import { NotificationBroadcaster } from "~tracer-api/config/notification.broadcaster.js";
import { NotificationConsumer } from "~tracer-api/config/notification.consumer.js";
import { WsGateway } from "~tracer-api/domain/session/inbound/ws.gateway.js";
import { TracerApiModule } from "./tracer.api.module.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;
const BODY_LIMIT = "8mb";

async function bootstrap(): Promise<void> {
    const config = loadApplicationConfig();
    // 마이그레이션은 배포 선행 스텝이 소유하고 부트는 스키마 버전만 검사한다.
    const dataSource = createDataSource({
        db: config.tracerDb,
        entities: TRACER_ENTITIES,
        migrations: [],
        migrationsRun: false,
    });
    await dataSource.initialize();
    await assertSchemaUpToDate(dataSource, TRACER_MIGRATIONS.map((migration) => migration.name));

    const kafka = createKafka("tracer-api");
    const broadcaster = new NotificationBroadcaster();
    const gateway = new WsGateway(broadcaster);
    const consumer = new NotificationConsumer(kafka, broadcaster);

    const app = await NestFactory.create<NestExpressApplication>(
        TracerApiModule.forRoot(dataSource, kafka, broadcaster),
        { logger: ["error", "warn"] },
    );
    app.use(helmet());
    app.enableCors({
        origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
        credentials: true,
    });
    app.useBodyParser("json", { limit: BODY_LIMIT });

    gateway.attach(app.getHttpServer());

    const host = config.listenHost;
    const { port } = config.tracerApi;
    await app.listen(port, host);
    logInfo({ msg: "tracer-api.started", host, port });

    try {
        await consumer.start();
    } catch (error) {
        logError({ msg: "tracer-api.notificationConsumer.startFailed", error: errorMessage(error) });
    }

    let shuttingDown = false;
    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
        if (shuttingDown) return;
        shuttingDown = true;
        logInfo({ msg: "tracer-api.shutdown", signal });

        const forceExit = setTimeout(() => {
            logError({ msg: "tracer-api.shutdown.timeout" });
            process.exit(1);
        }, SHUTDOWN_TIMEOUT_MS);
        forceExit.unref();
        try {
            await consumer.stop();
            await gateway.close();
            await app.close();
            await dataSource.destroy();
            process.exit(0);
        } catch (error) {
            logError({ msg: "tracer-api.shutdown.error", error: errorMessage(error) });
            process.exit(1);
        }
    };
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
    process.once("SIGINT", () => void shutdown("SIGINT"));
}

/** 브라우저 출처는 루프백만 허용하고 Origin 없는 네이티브 클라이언트는 통과시킨다. */
function isOriginAllowed(origin: string | undefined): boolean {
    if (process.env["MONITOR_CORS_ALLOW_ANY_ORIGIN"] === "1") return true;
    if (origin === undefined || origin.length === 0) return true;
    try {
        return isLoopbackHost(new URL(origin).hostname);
    } catch {
        return false;
    }
}

function isLoopbackHost(host: string): boolean {
    const normalized = host.toLowerCase();
    return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
}

await bootstrap().catch((error: unknown) => {
    if (error instanceof SchemaOutOfDateError) {
        logError({ msg: "tracer-api.schema.outOfDate", missingMigrations: error.missingMigrations });
        process.exit(1);
    }
    logError({ msg: "tracer-api.bootstrap.failed", error: errorMessage(error) });
    process.exit(1);
});
