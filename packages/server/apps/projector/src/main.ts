import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { CONSUMER_GROUP } from "@monitor/kernel";
import { TRACER_ENTITIES } from "@monitor/tracer-domain";
import {
    createDataSource,
    createKafka,
    createKafkaConsumer,
    createKafkaReadinessProbe,
    createOpenSearchClient,
    loadApplicationConfig,
    SchemaOutOfDateError,
} from "@monitor/platform";
import { TypeOrmTracerDatabaseAdapter } from "~projector/domain/project/adapter/typeorm.tracer.database.adapter.js";
import { DbConsumer } from "~projector/domain/project/inbound/db.consumer.js";
import { TypeOrmAdvisoryLockAdapter } from "~projector/domain/recover/adapter/typeorm.advisory.lock.adapter.js";
import { AiJobStepReaperService } from "~projector/domain/recover/application/ai.job.step.reaper.service.js";
import { JobLeaseReaperService } from "~projector/domain/recover/application/job.lease.reaper.service.js";
import { TaskReaperService } from "~projector/domain/recover/application/task.reaper.service.js";
import { OpenSearchIndexAdapter } from "~projector/domain/index/adapter/open.search.index.adapter.js";
import { TypeOrmSearchOutboxLockAdapter } from "~projector/domain/index/adapter/typeorm.search.outbox.lock.adapter.js";
import { SearchEventsReaperService } from "~projector/domain/index/application/search.events.reaper.service.js";
import { SearchOutboxDrainService } from "~projector/domain/index/application/search.outbox.drain.service.js";
import { SearchConsumer } from "~projector/domain/index/inbound/search.consumer.js";
import { OtlpConsumer } from "~projector/domain/export/inbound/otlp.consumer.js";
import { loadProjectorRuntimeConfig } from "~projector/config/projector.runtime.config.js";
import { errorMessage, logError, logInfo } from "~projector/support/log.js";
import { startHealthServer } from "~projector/support/health.server.js";
import { ProjectorModule } from "./projector.module.js";

const CONSUMER_MAX_BATCH_SIZE = 100;
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function bootstrap(): Promise<void> {
    const config = loadApplicationConfig();
    const runtimeConfig = loadProjectorRuntimeConfig();

    const dataSource = createDataSource({ db: config.tracerDb, entities: TRACER_ENTITIES, migrations: [], migrationsRun: false });
    const database = new TypeOrmTracerDatabaseAdapter(dataSource);
    const recoverLock = new TypeOrmAdvisoryLockAdapter(dataSource);
    const indexLock = new TypeOrmSearchOutboxLockAdapter(dataSource);

    const kafka = createKafka("projector");
    const searchClient = createOpenSearchClient();
    const searchIndex = new OpenSearchIndexAdapter(searchClient);
    const healthServer = startHealthServer(config.projector.port, config.listenHost, database, [
        createKafkaReadinessProbe(kafka),
        searchIndex,
    ]);

    await database.initialize();

    const producer = kafka.producer();
    await producer.connect();
    const dbEventConsumer = createKafkaConsumer(kafka, {
        groupId: CONSUMER_GROUP.projectorDb,
        fromBeginning: true,
        maxBatchSize: CONSUMER_MAX_BATCH_SIZE,
    });
    const searchEventConsumer = createKafkaConsumer(kafka, {
        groupId: CONSUMER_GROUP.projectorSearch,
        fromBeginning: true,
        maxBatchSize: CONSUMER_MAX_BATCH_SIZE,
    });
    // EVENTS_OTLP_ENDPOINT는 이벤트 tee 대상이며 projector 자체 계측 설정과 분리된다.
    const otlp = runtimeConfig.eventsOtlp
        ? {
            endpoint: runtimeConfig.eventsOtlp.endpoint,
            consumer: createKafkaConsumer(kafka, {
                groupId: CONSUMER_GROUP.projectorOtlp,
                fromBeginning: true,
                maxBatchSize: CONSUMER_MAX_BATCH_SIZE,
            }),
        }
        : undefined;

    const app = await NestFactory.createApplicationContext(
        ProjectorModule.forRoot({
            database,
            recoverLock,
            indexLock,
            producer,
            dbEventConsumer,
            searchEventConsumer,
            searchIndex,
            otlp,
        }),
        { logger: ["error", "warn"] },
    );

    const dbConsumer = app.get(DbConsumer);
    const searchConsumer = app.get(SearchConsumer);
    const otlpConsumer = otlp ? app.get(OtlpConsumer) : null;
    const reaper = app.get(TaskReaperService);
    const aiJobStepReaper = app.get(AiJobStepReaperService);
    const jobLeaseReaper = app.get(JobLeaseReaperService);
    const searchOutboxDrain = app.get(SearchOutboxDrainService);
    const searchEventsReaper = app.get(SearchEventsReaperService);

    await searchConsumer.ensureIndices();
    await dbConsumer.start();
    await searchConsumer.start();
    if (otlpConsumer) await otlpConsumer.start();
    reaper.start(runtimeConfig.taskReaper.intervalMs, runtimeConfig.taskReaper.idleMs);
    aiJobStepReaper.start(runtimeConfig.aiJobStepReaper.intervalMs, runtimeConfig.aiJobStepReaper.retentionMs);
    jobLeaseReaper.start(runtimeConfig.jobLeaseReapIntervalMs);
    searchOutboxDrain.start(runtimeConfig.searchOutboxDrainIntervalMs);
    searchEventsReaper.start(
        runtimeConfig.searchEventsReaper.intervalMs,
        runtimeConfig.searchEventsReaper.retentionMs,
    );
    logInfo({ msg: "projector.started", otlpExport: otlp !== undefined });

    let shuttingDown = false;
    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
        if (shuttingDown) return;
        shuttingDown = true;
        logInfo({ msg: "projector.shutdown", signal });

        const forceExit = setTimeout(() => {
            logError({ msg: "projector.shutdown.timeout" });
            process.exit(1);
        }, SHUTDOWN_TIMEOUT_MS);
        forceExit.unref();
        try {
            reaper.stop();
            aiJobStepReaper.stop();
            jobLeaseReaper.stop();
            searchOutboxDrain.stop();
            searchEventsReaper.stop();
            await dbConsumer.stop();
            await searchConsumer.stop();
            if (otlpConsumer) await otlpConsumer.stop();
            await producer.disconnect();
            await app.close();
            await database.destroy();
            await new Promise<void>((resolve) => healthServer.close(() => resolve()));
            process.exit(0);
        } catch (error) {
            logError({ msg: "projector.shutdown.error", error: errorMessage(error) });
            process.exit(1);
        }
    };
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
    process.once("SIGINT", () => void shutdown("SIGINT"));
}

await bootstrap().catch((error: unknown) => {
    if (error instanceof SchemaOutOfDateError) {
        logError({ msg: "projector.schema.outOfDate", missingMigrations: error.missingMigrations });
        process.stderr.write("[projector] 스키마가 최신이 아니다. 배포 전 `npm run migration:run`을 먼저 실행하라.\n");
        process.exit(1);
    }
    logError({ msg: "projector.bootstrap.failed", error: errorMessage(error) });
    process.exit(1);
});
