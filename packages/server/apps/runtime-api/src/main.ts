import "reflect-metadata";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import {
    assertSchemaUpToDate,
    createDataSource,
    loadApplicationConfig,
    SchemaOutOfDateError,
} from "@monitor/platform";
import { LedgerEventEntity } from "~runtime-api/domain/ingest/adapter/ledger.event.entity.js";
import { RUNTIME_MIGRATIONS } from "~runtime-api/migrations/registry.js";
import { errorMessage, logError, logInfo } from "~runtime-api/config/log.js";
import { RuntimeApiModule } from "./runtime.api.module.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;
const BODY_LIMIT = "8mb";

async function bootstrap(): Promise<void> {
    const config = loadApplicationConfig();
    // 마이그레이션은 배포 선행 스텝이 소유하고 부트는 스키마 버전만 검사한다.
    const dataSource = createDataSource({
        db: config.runtimeDb,
        entities: [LedgerEventEntity],
        migrations: [],
        migrationsRun: false,
    });
    await dataSource.initialize();
    await assertSchemaUpToDate(dataSource, RUNTIME_MIGRATIONS.map((migration) => migration.name));

    const app = await NestFactory.create<NestExpressApplication>(
        RuntimeApiModule.forRoot(dataSource),
        { logger: ["error", "warn"] },
    );
    app.use(helmet());

    // 이벤트 배치에는 도구 출력이 포함되므로 기본 100kb보다 큰 본문을 허용한다.
    app.useBodyParser("json", { limit: BODY_LIMIT });

    const host = config.listenHost;
    const { port } = config.runtimeApi;
    await app.listen(port, host);
    logInfo({ msg: "runtime-api.started", host, port });

    let shuttingDown = false;
    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
        if (shuttingDown) return;
        shuttingDown = true;
        logInfo({ msg: "runtime-api.shutdown", signal });

        const forceExit = setTimeout(() => {
            logError({ msg: "runtime-api.shutdown.timeout" });
            process.exit(1);
        }, SHUTDOWN_TIMEOUT_MS);
        forceExit.unref();
        try {
            await app.close();
            await dataSource.destroy();
            process.exit(0);
        } catch (error) {
            logError({ msg: "runtime-api.shutdown.error", error: errorMessage(error) });
            process.exit(1);
        }
    };
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
    process.once("SIGINT", () => void shutdown("SIGINT"));
}

await bootstrap().catch((error: unknown) => {
    if (error instanceof SchemaOutOfDateError) {
        logError({ msg: "runtime-api.schema.outOfDate", missingMigrations: error.missingMigrations });
        process.exit(1);
    }
    logError({ msg: "runtime-api.bootstrap.failed", error: errorMessage(error) });
    process.exit(1);
});
