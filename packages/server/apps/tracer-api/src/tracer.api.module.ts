import { Module, type DynamicModule, type Provider, type Type } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { createOpenSearchClient, TokenBucketLimiter } from "@monitor/platform";
import type { createDataSource, createKafka } from "@monitor/platform";
import { TaskRepository } from "@monitor/tracer-domain";
import { chatFeature } from "~tracer-api/domain/chat/chat.feature.js";
import { CHAT_TOOL_EXECUTORS } from "~tracer-api/domain/chat/port/chat.tool.executors.port.js";
import { buildChatToolExecutors, type ChatToolExecutorDeps } from "~tracer-api/chat.tool.executors.js";
import { RenameTaskUseCase } from "~tracer-api/domain/task/application/command/rename.task.usecase.js";
import { SetTaskStatusUseCase } from "~tracer-api/domain/task/application/command/set.task.status.usecase.js";
import { ArchiveTaskUseCase } from "~tracer-api/domain/task/application/command/archive.task.usecase.js";
import { UnarchiveTaskUseCase } from "~tracer-api/domain/task/application/command/unarchive.task.usecase.js";
import { HideTaskUseCase } from "~tracer-api/domain/task/application/command/hide.task.usecase.js";
import { CreateMemoUseCase } from "~tracer-api/domain/memo/application/command/create.memo.usecase.js";
import { UpdateMemoUseCase } from "~tracer-api/domain/memo/application/command/update.memo.usecase.js";
import { DeleteMemoUseCase } from "~tracer-api/domain/memo/application/command/delete.memo.usecase.js";
import { CreateRuleUseCase } from "~tracer-api/domain/rule/application/command/create.rule.usecase.js";
import { UpdateRuleUseCase } from "~tracer-api/domain/rule/application/command/update.rule.usecase.js";
import { DeleteRuleUseCase } from "~tracer-api/domain/rule/application/command/delete.rule.usecase.js";
import { ApproveRuleUseCase } from "~tracer-api/domain/rule/application/command/approve.rule.usecase.js";
import { ReevaluateRuleUseCase } from "~tracer-api/domain/rule/application/command/reevaluate.rule.usecase.js";
import { CreateTagUseCase } from "~tracer-api/domain/tag/application/command/create.tag.usecase.js";
import { UpdateTagUseCase } from "~tracer-api/domain/tag/application/command/update.tag.usecase.js";
import { DeleteTagUseCase } from "~tracer-api/domain/tag/application/command/delete.tag.usecase.js";
import { SetTaskTagsUseCase } from "~tracer-api/domain/tag/application/command/set.task.tags.usecase.js";
import { AcceptRecipeUseCase } from "~tracer-api/domain/recipe/application/command/accept.recipe.usecase.js";
import { DismissRecipeUseCase } from "~tracer-api/domain/recipe/application/command/dismiss.recipe.usecase.js";
import { RetireRecipeUseCase } from "~tracer-api/domain/recipe/application/command/retire.recipe.usecase.js";
import { AcceptCleanupSuggestionUseCase } from "~tracer-api/domain/cleanup/application/command/accept.cleanup.suggestion.usecase.js";
import { DismissCleanupSuggestionUseCase } from "~tracer-api/domain/cleanup/application/command/dismiss.cleanup.suggestion.usecase.js";
import { PutSettingUseCase } from "~tracer-api/domain/settings/application/command/put.setting.usecase.js";
import { DeleteSettingUseCase } from "~tracer-api/domain/settings/application/command/delete.setting.usecase.js";
import { cleanupFeature } from "~tracer-api/domain/cleanup/cleanup.feature.js";
import { healthFeature } from "~tracer-api/domain/health/health.feature.js";
import { jobFeature } from "~tracer-api/domain/job/job.feature.js";
import { memoFeature } from "~tracer-api/domain/memo/memo.feature.js";
import { recipeFeature } from "~tracer-api/domain/recipe/recipe.feature.js";
import { ruleFeature } from "~tracer-api/domain/rule/rule.feature.js";
import { searchFeature } from "~tracer-api/domain/search/search.feature.js";
import { sessionFeature } from "~tracer-api/domain/session/session.feature.js";
import { settingsFeature } from "~tracer-api/domain/settings/settings.feature.js";
import { tagFeature } from "~tracer-api/domain/tag/tag.feature.js";
import { taskFeature } from "~tracer-api/domain/task/task.feature.js";
import { timelineFeature } from "~tracer-api/domain/timeline/timeline.feature.js";
import { userFeature } from "~tracer-api/domain/user/user.feature.js";
import { AuthGuard } from "~tracer-api/config/auth.guard.js";
import { RateLimitGuard, resolveApiRateLimiter } from "~tracer-api/config/rate.limit.guard.js";
import { GlobalExceptionFilter } from "~tracer-api/config/exception.filter.js";
import { ResponseEnvelopeInterceptor } from "~tracer-api/config/response.envelope.interceptor.js";
import { AccessLogInterceptor } from "~tracer-api/config/access.log.interceptor.js";
import { NotificationBroadcaster } from "~tracer-api/config/notification.broadcaster.js";
import { OPENSEARCH_CLIENT } from "~tracer-api/config/opensearch.client.const.js";
import { TRACER_DATA_SOURCE, TRACER_KAFKA } from "~tracer-api/config/tracer.datasource.token.js";
import { repositoryProviders } from "~tracer-api/config/repository.providers.js";

type TracerDataSource = ReturnType<typeof createDataSource>;
type TracerKafka = ReturnType<typeof createKafka>;

/** 슬라이스 하나가 조립 근원에 공급하는 controller와 provider 목록이다. */
interface ApiFeatureCatalog {
    readonly controllers: readonly Type[];
    readonly providers: readonly Provider[];
}

const apiFeatures: readonly ApiFeatureCatalog[] = [
    chatFeature,
    cleanupFeature,
    healthFeature,
    jobFeature,
    memoFeature,
    recipeFeature,
    ruleFeature,
    searchFeature,
    sessionFeature,
    settingsFeature,
    tagFeature,
    taskFeature,
    timelineFeature,
    userFeature,
];

// 확인 게이트의 실행자는 여러 슬라이스의 명령 유스케이스를 엮으므로 슬라이스 밖 조립 근원만 이 배선을 안다.
const CHAT_EXECUTOR_DEPS = [
    TaskRepository,
    RenameTaskUseCase, SetTaskStatusUseCase, ArchiveTaskUseCase, UnarchiveTaskUseCase, HideTaskUseCase,
    CreateMemoUseCase, UpdateMemoUseCase, DeleteMemoUseCase,
    CreateRuleUseCase, UpdateRuleUseCase, DeleteRuleUseCase, ApproveRuleUseCase, ReevaluateRuleUseCase,
    CreateTagUseCase, UpdateTagUseCase, DeleteTagUseCase, SetTaskTagsUseCase,
    AcceptRecipeUseCase, DismissRecipeUseCase, RetireRecipeUseCase,
    AcceptCleanupSuggestionUseCase, DismissCleanupSuggestionUseCase,
    PutSettingUseCase, DeleteSettingUseCase,
];

function buildChatExecutorsFromArgs(...args: unknown[]): ReturnType<typeof buildChatToolExecutors> {
    const [
        tasks, renameTask, setTaskStatus, archiveTask, unarchiveTask, hideTask,
        createMemo, updateMemo, deleteMemo,
        createRule, updateRule, deleteRule, approveRule, reevaluateRule,
        createTag, updateTag, deleteTag, setTaskTags,
        acceptRecipe, dismissRecipe, retireRecipe,
        acceptCleanup, dismissCleanup, putSetting, deleteSetting,
    ] = args;
    return buildChatToolExecutors({
        tasks, renameTask, setTaskStatus, archiveTask, unarchiveTask, hideTask,
        createMemo, updateMemo, deleteMemo,
        createRule, updateRule, deleteRule, approveRule, reevaluateRule,
        createTag, updateTag, deleteTag, setTaskTags,
        acceptRecipe, dismissRecipe, retireRecipe,
        acceptCleanup, dismissCleanup, putSetting, deleteSetting,
    } as ChatToolExecutorDeps);
}

const chatToolExecutorsProvider: Provider = {
    provide: CHAT_TOOL_EXECUTORS,
    inject: CHAT_EXECUTOR_DEPS,
    useFactory: buildChatExecutorsFromArgs,
};

/** tracer-api 열두 슬라이스를 모아 앱 전역 배선과 함께 조립하는 근원 모듈이다. */
@Module({})
export class TracerApiModule {
    static forRoot(
        dataSource: TracerDataSource,
        kafka: TracerKafka,
        broadcaster: NotificationBroadcaster,
    ): DynamicModule {
        return {
            module: TracerApiModule,
            controllers: apiFeatures.flatMap((feature) => feature.controllers),
            providers: [
                { provide: TokenBucketLimiter, useFactory: resolveApiRateLimiter },
                { provide: APP_GUARD, useClass: AuthGuard },
                { provide: APP_GUARD, useClass: RateLimitGuard },
                { provide: TRACER_DATA_SOURCE, useValue: dataSource },
                { provide: TRACER_KAFKA, useValue: kafka },
                { provide: NotificationBroadcaster, useValue: broadcaster },
                { provide: OPENSEARCH_CLIENT, useFactory: () => createOpenSearchClient() },
                ...repositoryProviders,
                ...apiFeatures.flatMap((feature) => feature.providers),
                chatToolExecutorsProvider,
                { provide: APP_INTERCEPTOR, useClass: AccessLogInterceptor },
                { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
                { provide: APP_FILTER, useClass: GlobalExceptionFilter },
            ],
        };
    }
}
