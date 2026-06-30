import { Global, Module } from "@nestjs/common";
import { TemporalClientProvider } from "@monitor/shared/job/temporal.client.provider.js";
import { RULE_GENERATION_DISPATCHER } from "@monitor/rules-api/rule/generation/application/outbound/rule.generation.dispatcher.port.js";
import { TemporalRuleGenerationDispatcher } from "@monitor/rules-api/rule/generation/adapter/temporal.rule.generation.dispatcher.js";
import { TITLE_SUGGESTION_DISPATCHER } from "@monitor/run-api/task/application/outbound/title.suggestion.dispatcher.port.js";
import { TemporalTitleSuggestionDispatcher } from "@monitor/run-api/task/adapter/temporal.title.suggestion.dispatcher.js";
import { RECIPE_SCAN_DISPATCHER } from "@monitor/insight-api/recipe/application/outbound/recipe.scan.dispatcher.port.js";
import { TemporalRecipeScanDispatcher } from "@monitor/insight-api/recipe/adapter/temporal.recipe.scan.dispatcher.js";
import { TASK_CLEANUP_DISPATCHER } from "@monitor/insight-api/task-cleanup/application/outbound/task.cleanup.dispatcher.port.js";
import { TemporalTaskCleanupDispatcher } from "@monitor/insight-api/task-cleanup/adapter/temporal.task.cleanup.dispatcher.js";

// 제출측 합성: 각 컨텍스트의 Temporal 디스패처를 도메인 포트에 바인딩한다.
@Global()
@Module({
    providers: [
        TemporalClientProvider,
        TemporalRuleGenerationDispatcher,
        TemporalTitleSuggestionDispatcher,
        TemporalRecipeScanDispatcher,
        TemporalTaskCleanupDispatcher,
        { provide: RULE_GENERATION_DISPATCHER, useExisting: TemporalRuleGenerationDispatcher },
        { provide: TITLE_SUGGESTION_DISPATCHER, useExisting: TemporalTitleSuggestionDispatcher },
        { provide: RECIPE_SCAN_DISPATCHER, useExisting: TemporalRecipeScanDispatcher },
        { provide: TASK_CLEANUP_DISPATCHER, useExisting: TemporalTaskCleanupDispatcher },
    ],
    exports: [
        RULE_GENERATION_DISPATCHER,
        TITLE_SUGGESTION_DISPATCHER,
        RECIPE_SCAN_DISPATCHER,
        TASK_CLEANUP_DISPATCHER,
    ],
})
export class TemporalDispatchModule {}
