import "reflect-metadata";
import { initializeTransactionalContext } from "typeorm-transactional";
import { createClient } from "redis";
import { NestFactory } from "@nestjs/core";
import { NativeConnection, Worker } from "@temporalio/worker";
import { AppModule } from "@monitor/api-gateway/app-module";
import { RedisNotificationPublisher } from "@monitor/ws-gateway/redis.notification.publisher.js";
import { TaskRuleGenerationService } from "@monitor/rules-api/rule/generation/service/task.rule.generation.service.js";
import { SuggestTaskTitleUseCase } from "@monitor/run-api/task/application/suggest.task.title.usecase.js";
import { createRuleGenerationActivities } from "./activities/rule-generation.activities.js";
import { createTitleSuggestionActivities } from "./activities/title-suggestion.activities.js";
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
        AppModule.forRoot({ notifier }),
        { logger: ["error", "warn"] },
    );
    const ruleGeneration = app.get(TaskRuleGenerationService, { strict: false });
    const titleSuggestion = app.get(SuggestTaskTitleUseCase, { strict: false });

    const address = process.env["TEMPORAL_ADDRESS"] ?? "localhost:7233";
    const connection = await NativeConnection.connect({ address });
    // dev는 소스(.ts), 빌드본은 dist(.js)에서 워크플로를 로드한다.
    const workflowsModule = import.meta.url.endsWith(".ts")
        ? "./workflows/index.ts"
        : "./workflows/index.js";
    const worker = await Worker.create({
        connection,
        namespace: "default",
        taskQueue: LLM_JOB_QUEUE,
        workflowsPath: new URL(workflowsModule, import.meta.url).pathname,
        activities: {
            ...createRuleGenerationActivities(ruleGeneration, notifier),
            ...createTitleSuggestionActivities(titleSuggestion),
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
