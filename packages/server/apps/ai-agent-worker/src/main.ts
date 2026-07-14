import "reflect-metadata";
import {
    assertSchemaUpToDate,
    createDataSource,
    createKafka,
    createOpenSearchClient,
    loadApplicationConfig,
    SchemaOutOfDateError,
    SystemClock,
} from "@monitor/platform";
import {
    AiJobEntity,
    AiJobRepository,
    AppSettingEntity,
    AppSettingRepository,
    EventEntity,
    EventRepository,
    RuleEntity,
    RuleRepository,
    TaskEntity,
    TaskRepository,
    TaskUserStateEntity,
    TaskUserStateRepository,
    TransactionRunner,
    TurnEntity,
    TurnRepository,
} from "@monitor/tracer-domain";
import { TRACER_MIGRATIONS } from "@monitor/tracer-domain/migrations/registry.js";
import { TRACER_ENTITIES } from "@monitor/tracer-domain/persistence/tracer.entities.js";
import { resolveDefaultAgentBackend } from "~ai-agent-worker/config/agent.backend.js";
import { ClaudeQueryRunner } from "~ai-agent-worker/config/llm/claude.query.runner.js";
import { AgentGraphClient } from "~ai-agent-worker/config/llm/graph.client.js";
import { AgentCallbackServer } from "~ai-agent-worker/config/llm/agent.callback.server.js";
import { errorMessage, logError, logInfo } from "~ai-agent-worker/config/log.js";
import { createNotificationPublisher } from "~ai-agent-worker/config/notification.js";
import { createTemporalWorkers } from "~ai-agent-worker/config/temporal.worker.js";
import { AGENT_BACKEND } from "~ai-agent-worker/support/llm/agent.backend.js";
import { CleanupGraphAgentAdapter } from "~ai-agent-worker/domain/cleanup/adapter/cleanup.graph.agent.adapter.js";
import { CleanupNotificationAdapter } from "~ai-agent-worker/domain/cleanup/adapter/cleanup.notification.adapter.js";
import { CleanupRepositoryAdapter } from "~ai-agent-worker/domain/cleanup/adapter/cleanup.repository.adapter.js";
import { CleanupSdkAgentAdapter } from "~ai-agent-worker/domain/cleanup/adapter/cleanup.sdk.agent.adapter.js";
import { FailCleanupJobUsecase } from "~ai-agent-worker/domain/cleanup/application/fail.cleanup.job.usecase.js";
import { FinalizeTaskCleanupUsecase } from "~ai-agent-worker/domain/cleanup/application/finalize.task.cleanup.usecase.js";
import { PrepareTaskCleanupUsecase } from "~ai-agent-worker/domain/cleanup/application/prepare.task.cleanup.usecase.js";
import { SuggestCleanupUsecase } from "~ai-agent-worker/domain/cleanup/application/suggest.cleanup.usecase.js";
import { CleanupActivity } from "~ai-agent-worker/domain/cleanup/inbound/cleanup.activity.js";
import { RecipeGraphAgentAdapter } from "~ai-agent-worker/domain/recipe/adapter/recipe.graph.agent.adapter.js";
import { RecipeNotificationAdapter } from "~ai-agent-worker/domain/recipe/adapter/recipe.notification.adapter.js";
import { RecipeRepositoryAdapter } from "~ai-agent-worker/domain/recipe/adapter/recipe.repository.adapter.js";
import { RecipeSdkAgentAdapter } from "~ai-agent-worker/domain/recipe/adapter/recipe.sdk.agent.adapter.js";
import { FailRecipeJobUsecase } from "~ai-agent-worker/domain/recipe/application/fail.recipe.job.usecase.js";
import { FinalizeRecipeScanUsecase } from "~ai-agent-worker/domain/recipe/application/finalize.recipe.scan.usecase.js";
import { PrepareRecipeScanUsecase } from "~ai-agent-worker/domain/recipe/application/prepare.recipe.scan.usecase.js";
import { ScanRecipeUsecase } from "~ai-agent-worker/domain/recipe/application/scan.recipe.usecase.js";
import { RecipeActivity } from "~ai-agent-worker/domain/recipe/inbound/recipe.activity.js";
import { TitleGraphAgentAdapter } from "~ai-agent-worker/domain/title/adapter/title.graph.agent.adapter.js";
import { TitleNotificationAdapter } from "~ai-agent-worker/domain/title/adapter/title.notification.adapter.js";
import { TitleRepositoryAdapter } from "~ai-agent-worker/domain/title/adapter/title.repository.adapter.js";
import { TitleSdkAgentAdapter } from "~ai-agent-worker/domain/title/adapter/title.sdk.agent.adapter.js";
import { FailTitleJobUsecase } from "~ai-agent-worker/domain/title/application/fail.title.job.usecase.js";
import { FinalizeTitleSuggestionUsecase } from "~ai-agent-worker/domain/title/application/finalize.title.suggestion.usecase.js";
import { PrepareTitleSuggestionUsecase } from "~ai-agent-worker/domain/title/application/prepare.title.suggestion.usecase.js";
import { SuggestTitleUsecase } from "~ai-agent-worker/domain/title/application/suggest.title.usecase.js";
import { TitleActivity } from "~ai-agent-worker/domain/title/inbound/title.activity.js";

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

    const kafka = createKafka("ai-agent-worker");
    const producer = kafka.producer();
    await producer.connect();
    const publish = createNotificationPublisher(producer);

    const clock = new SystemClock();
    const jobs = new AiJobRepository(dataSource.getRepository(AiJobEntity));
    const tasks = new TaskRepository(dataSource.getRepository(TaskEntity));
    const taskStates = new TaskUserStateRepository(dataSource.getRepository(TaskUserStateEntity));
    const events = new EventRepository(dataSource.getRepository(EventEntity));
    const turns = new TurnRepository(dataSource.getRepository(TurnEntity));
    const rules = new RuleRepository(dataSource.getRepository(RuleEntity));
    const settings = new AppSettingRepository(dataSource.getRepository(AppSettingEntity));
    const tx = new TransactionRunner(dataSource);
    const search = createOpenSearchClient();

    const defaultBackend = resolveDefaultAgentBackend();
    const callbacks = new AgentCallbackServer(
        config.agentGraph.toolCallbackPort,
        config.agentGraph.toolCallbackUrl,
        config.agentGraph.instanceId,
    );
    await callbacks.start();
    const graphClient = new AgentGraphClient(config.agentGraph.url, callbacks);
    // 세 에이전트 모두 도구를 쓰므로 Claude 쪽은 Agent SDK 러너 하나로 충분하다.
    const claudeRunner = new ClaudeQueryRunner();

    const recipeTools = { tasks, events, rules, search };
    const recipeRepository = new RecipeRepositoryAdapter(jobs, tasks, taskStates, settings, tx);
    const recipeNotification = new RecipeNotificationAdapter(publish);
    const recipeAgents = {
        [AGENT_BACKEND.python]: new RecipeGraphAgentAdapter(graphClient, callbacks, recipeTools),
        [AGENT_BACKEND.claudeSdk]: new RecipeSdkAgentAdapter(claudeRunner, recipeTools),
    };
    const recipe = new RecipeActivity(
        new PrepareRecipeScanUsecase(recipeRepository, recipeAgents, recipeNotification, clock, defaultBackend),
        new ScanRecipeUsecase(recipeRepository, recipeAgents, clock),
        new FinalizeRecipeScanUsecase(recipeRepository, recipeNotification, clock),
        new FailRecipeJobUsecase(recipeRepository, recipeNotification, clock),
    );

    const titleTools = { tasks, events };
    const titleRepository = new TitleRepositoryAdapter(jobs, tasks, events, turns, settings, tx);
    const titleNotification = new TitleNotificationAdapter(publish);
    const titleAgents = {
        [AGENT_BACKEND.python]: new TitleGraphAgentAdapter(graphClient, callbacks, titleTools),
        [AGENT_BACKEND.claudeSdk]: new TitleSdkAgentAdapter(claudeRunner, titleTools),
    };
    const title = new TitleActivity(
        new PrepareTitleSuggestionUsecase(titleRepository, titleAgents, titleNotification, clock, defaultBackend),
        new SuggestTitleUsecase(titleRepository, titleAgents, clock),
        new FinalizeTitleSuggestionUsecase(titleRepository, titleNotification, clock),
        new FailTitleJobUsecase(titleRepository, titleNotification, clock),
    );

    const cleanupTools = { tasks, events };
    const cleanupRepository = new CleanupRepositoryAdapter(jobs, tasks, taskStates, settings, tx);
    const cleanupNotification = new CleanupNotificationAdapter(publish);
    const cleanupAgents = {
        [AGENT_BACKEND.python]: new CleanupGraphAgentAdapter(graphClient, callbacks, cleanupTools),
        [AGENT_BACKEND.claudeSdk]: new CleanupSdkAgentAdapter(claudeRunner, cleanupTools),
    };
    const cleanup = new CleanupActivity(
        new PrepareTaskCleanupUsecase(cleanupRepository, cleanupAgents, cleanupNotification, clock, defaultBackend),
        new SuggestCleanupUsecase(cleanupRepository, cleanupAgents, clock),
        new FinalizeTaskCleanupUsecase(cleanupRepository, cleanupNotification, clock),
        new FailCleanupJobUsecase(cleanupRepository, cleanupNotification, clock),
    );

    const workers = await createTemporalWorkers({
        address: config.temporal.address,
        namespace: config.temporal.namespace,
        lightActivities: {
            prepareRecipeScan: recipe.prepareRecipeScan,
            finalizeRecipeScan: recipe.finalizeRecipeScan,
            markRecipeJobFailed: recipe.markRecipeJobFailed,
            prepareTitleSuggestion: title.prepareTitleSuggestion,
            finalizeTitleSuggestion: title.finalizeTitleSuggestion,
            markTitleJobFailed: title.markTitleJobFailed,
            prepareTaskCleanup: cleanup.prepareTaskCleanup,
            finalizeTaskCleanup: cleanup.finalizeTaskCleanup,
            markCleanupJobFailed: cleanup.markCleanupJobFailed,
        },
        generateActivities: {
            generateRecipeCandidates: recipe.generateRecipeCandidates,
            generateTitleSuggestion: title.generateTitleSuggestion,
            generateTaskCleanupSuggestions: cleanup.generateTaskCleanupSuggestions,
        },
    });
    logInfo({ msg: "ai-agent-worker.started", agentBackend: defaultBackend });

    const shutdown = (signal: NodeJS.Signals): void => {
        logInfo({ msg: "ai-agent-worker.shutdown", signal });
        void callbacks.close();
        workers.shutdown();
    };
    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));

    try {
        await workers.run();
    } finally {
        await producer.disconnect().catch(() => undefined);
        await workers.close().catch(() => undefined);
        await dataSource.destroy().catch(() => undefined);
    }
}

await bootstrap().catch((error: unknown) => {
    if (error instanceof SchemaOutOfDateError) {
        logError({ msg: "ai-agent-worker.schema.outOfDate", missingMigrations: error.missingMigrations });
        process.exit(1);
    }
    logError({ msg: "ai-agent-worker.bootstrap.failed", error: errorMessage(error) });
    process.exit(1);
});
