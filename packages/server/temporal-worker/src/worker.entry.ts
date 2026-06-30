import "reflect-metadata";
import { initializeTransactionalContext } from "typeorm-transactional";
import { createClient } from "redis";
import { NestFactory } from "@nestjs/core";
import { NativeConnection, Worker } from "@temporalio/worker";
import { WorkerRootModule } from "./worker.root.module.js";
import { RedisNotificationPublisher } from "@monitor/ws-gateway/redis.notification.publisher.js";
import { LocalQueryRunner } from "@monitor/shared/llm/local.query.runner.js";
import { MessagesQueryRunner } from "@monitor/shared/llm/messages.query.runner.js";
import { RuleJobRepository } from "@monitor/rules-api/job/rule.job.repository.js";
import { ListRulesUseCase } from "@monitor/rules-api/rule/application/list.rules.usecase.js";
import { RegisterSuggestionUseCase } from "@monitor/rules-api/rule/application/register.suggestion.usecase.js";
import { GetTaskSummaryUseCase } from "@monitor/run-api/task/application/get.task.summary.usecase.js";
import { APP_SETTINGS } from "@monitor/identity-api/settings/public/tokens.js";
import type { IAppSettings } from "@monitor/identity-api/settings/public/iservice/app.settings.iservice.js";
import { TASK_SUMMARY } from "@monitor/run-api/task/public/tokens.js";
import type { ITaskSummary } from "@monitor/run-api/task/public/iservice/task.summary.iservice.js";
import { RuleSuggestionAgent } from "./agents/rule.suggestion.agent.js";
import { TitleSuggestionAgent } from "./agents/title.suggestion.agent.js";
import { RuleGenerationRunner } from "./runners/rule-generation.runner.js";
import { TitleSuggestionRunner } from "./runners/title-suggestion.runner.js";
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
        WorkerRootModule.forRoot({ notifier }),
        { logger: ["error", "warn"] },
    );

    // 도메인 빌딩블록은 DI 그래프에서 가져오고, LLM 실행기·에이전트·러너는 워커가 직접 조립한다.
    const jobs = app.get(RuleJobRepository, { strict: false });
    const listRules = app.get(ListRulesUseCase, { strict: false });
    const registerSuggestion = app.get(RegisterSuggestionUseCase, { strict: false });
    const getSummary = app.get(GetTaskSummaryUseCase, { strict: false });
    const settings = app.get<IAppSettings>(APP_SETTINGS, { strict: false });
    const taskSummary = app.get<ITaskSummary>(TASK_SUMMARY, { strict: false });

    const ruleAgent = new RuleSuggestionAgent(new LocalQueryRunner());
    const titleAgent = new TitleSuggestionAgent(new MessagesQueryRunner());

    const ruleGeneration = new RuleGenerationRunner(
        jobs,
        settings,
        taskSummary,
        listRules,
        registerSuggestion,
        ruleAgent,
        notifier,
    );
    const titleSuggestion = new TitleSuggestionRunner(
        getSummary,
        settings,
        titleAgent,
        notifier,
    );

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
            ...createRuleGenerationActivities(ruleGeneration),
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
