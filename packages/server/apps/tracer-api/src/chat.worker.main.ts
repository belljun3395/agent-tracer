import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
    assertSchemaUpToDate,
    createDataSource,
    createKafka,
    loadApplicationConfig,
    SchemaOutOfDateError,
} from "@monitor/platform";
import { TRACER_ENTITIES } from "@monitor/tracer-domain";
import { TRACER_MIGRATIONS } from "@monitor/tracer-domain/migrations/registry.js";
import { createChatTemporalWorker } from "~tracer-api/config/chat.temporal.worker.js";
import { errorMessage, logError, logInfo } from "~tracer-api/config/log.js";
import { NotificationBroadcaster } from "~tracer-api/config/notification.broadcaster.js";
import { ChatExecutionActivity } from "~tracer-api/domain/chat/inbound/chat.execution.activity.js";
import { CHAT_EXECUTION_TASK_QUEUE } from "~tracer-api/domain/chat/model/chat.workflow.spec.js";
import { TracerApiModule } from "~tracer-api/tracer.api.module.js";

const SHUTDOWN_TIMEOUT_MS = 370_000;

async function bootstrap(): Promise<void> {
    const config = loadApplicationConfig();
    const dataSource = createDataSource({
        db: config.tracerDb,
        entities: TRACER_ENTITIES,
        migrations: [],
        migrationsRun: false,
    });
    await dataSource.initialize();
    await assertSchemaUpToDate(dataSource, TRACER_MIGRATIONS.map((migration) => migration.name));
    const kafka = createKafka("chat-agent-worker");
    const app = await NestFactory.createApplicationContext(
        TracerApiModule.forRoot(dataSource, kafka, new NotificationBroadcaster()),
        { logger: ["error", "warn"] },
    );
    const activity = app.get(ChatExecutionActivity);
    const worker = await createChatTemporalWorker({
        address: config.temporal.address,
        namespace: config.temporal.namespace,
        taskQueue: CHAT_EXECUTION_TASK_QUEUE,
        activities: {
            prepareChatExecution: activity.prepareChatExecution,
            generateChatExecution: activity.generateChatExecution,
            finalizeChatExecution: activity.finalizeChatExecution,
            failChatExecution: activity.failChatExecution,
            getNextChatExecution: activity.getNextChatExecution,
        },
    });
    logInfo({ msg: "chat.agent.worker.started" });

    let shuttingDown = false;
    const shutdown = (signal: NodeJS.Signals): void => {
        if (shuttingDown) return;
        shuttingDown = true;
        logInfo({ msg: "chat.agent.worker.shutdown", signal });
        worker.shutdown();
    };
    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
    try {
        await worker.run();
    } finally {
        const forceExit = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
        forceExit.unref();
        await worker.close();
        await app.close();
        await dataSource.destroy();
        clearTimeout(forceExit);
    }
}

await bootstrap().catch((error: unknown) => {
    if (error instanceof SchemaOutOfDateError) {
        logError({ msg: "chat.agent.worker.schema.outOfDate", missingMigrations: error.missingMigrations });
    } else {
        logError({ msg: "chat.agent.worker.failed", error: errorMessage(error) });
    }
    process.exit(1);
});
