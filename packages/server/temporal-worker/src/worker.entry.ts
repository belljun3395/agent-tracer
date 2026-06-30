import "reflect-metadata";
import { initializeTransactionalContext } from "typeorm-transactional";
import { createClient } from "redis";
import { NestFactory } from "@nestjs/core";
import { NativeConnection, Worker } from "@temporalio/worker";
import { WorkerRootModule } from "./worker.root.module.js";
import { RedisNotificationPublisher } from "@monitor/shared/contracts/notifications/redis.notification.publisher.js";
import { RuleGenerationActivity } from "./activities/rule.generation.activity.js";
import { TitleSuggestionActivity } from "./activities/title.suggestion.activity.js";
import { RecipeScanActivity } from "./activities/recipe.scan.activity.js";
import { TaskCleanupActivity } from "./activities/task.cleanup.activity.js";
import { LLM_JOB_QUEUE } from "@monitor/shared/job/llm.job.const.js";

// 리퍼 등 게이트웨이 전용 스케줄러가 워커에서 돌지 않게 한다.
process.env["MONITOR_ROLE"] = "worker";
initializeTransactionalContext();

async function main(): Promise<void> {
    // 진행 알림을 게이트웨이 WS 구독자에게 전하려고 같은 Redis 채널로 발행한다.
    const redisUrl = process.env["REDIS_URL"] ?? "redis://localhost:6379";
    const redis = createClient({ url: redisUrl });
    await redis.connect();
    const notifier = new RedisNotificationPublisher({
        publish: (channel, message) => redis.publish(channel, message),
    });

    const app = await NestFactory.createApplicationContext(
        WorkerRootModule.forRoot({ notifier }),
        { logger: ["error", "warn"] },
    );

    const ruleGeneration = app.get(RuleGenerationActivity);
    const titleSuggestion = app.get(TitleSuggestionActivity);
    const recipeScan = app.get(RecipeScanActivity);
    const taskCleanup = app.get(TaskCleanupActivity);

    const address = process.env["TEMPORAL_ADDRESS"] ?? "localhost:7233";
    const connection = await NativeConnection.connect({ address });
    const workflowsPath = new URL(
        `./workflows/index.${import.meta.url.endsWith(".ts") ? "ts" : "js"}`,
        import.meta.url,
    ).pathname;
    const worker = await Worker.create({
        connection,
        namespace: "default",
        taskQueue: LLM_JOB_QUEUE,
        workflowsPath,
        activities: {
            ...ruleGeneration.toActivities(),
            ...titleSuggestion.toActivities(),
            ...recipeScan.toActivities(),
            ...taskCleanup.toActivities(),
        },
    });

    process.stdout.write(
        `[temporal-worker] polling ${LLM_JOB_QUEUE} at ${address}\n`,
    );
    await worker.run();
    await app.close();
    await connection.close();
    await redis.quit();
}

main().catch((err: unknown) => {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    process.stderr.write(`[temporal-worker] ${message}\n`);
    process.exit(1);
});
