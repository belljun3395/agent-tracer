import { Global, Injectable, Module } from "@nestjs/common";
import {
    RULE_GENERATION_DISPATCHER,
    type IRuleGenerationDispatcher,
} from "@monitor/rules-api/public/generation/rule.generation.dispatcher.port.js";
import {
    TITLE_SUGGESTION_DISPATCHER,
    type ITitleSuggestionDispatcher,
} from "@monitor/run-api/public/task/title.suggestion.dispatcher.port.js";
import {
    RECIPE_SCAN_DISPATCHER,
    type IRecipeScanDispatcher,
} from "@monitor/insight-api/public/recipe/recipe.scan.dispatcher.port.js";
import {
    TASK_CLEANUP_DISPATCHER,
    type ITaskCleanupDispatcher,
} from "@monitor/insight-api/public/task-cleanup/task.cleanup.dispatcher.port.js";

const MESSAGE = "temporal-worker executes jobs; it does not dispatch them.";

// 워커는 제출측 유스케이스를 부팅하지만 실제 dispatch는 게이트웨이만 한다.
// RuleGeneration은 로컬 플러그인이 처리하므로 여기서도 noop이 맞다.
@Injectable()
export class UnsupportedRuleGenerationDispatcher implements IRuleGenerationDispatcher {
    async dispatch(): Promise<void> {}
}

@Injectable()
export class UnsupportedTitleSuggestionDispatcher implements ITitleSuggestionDispatcher {
    dispatch(): Promise<never> {
        throw new Error(MESSAGE);
    }
}

@Injectable()
export class UnsupportedRecipeScanDispatcher implements IRecipeScanDispatcher {
    dispatch(): Promise<never> {
        throw new Error(MESSAGE);
    }
}

@Injectable()
export class UnsupportedTaskCleanupDispatcher implements ITaskCleanupDispatcher {
    dispatch(): Promise<never> {
        throw new Error(MESSAGE);
    }
}

@Global()
@Module({
    providers: [
        UnsupportedRuleGenerationDispatcher,
        UnsupportedTitleSuggestionDispatcher,
        UnsupportedRecipeScanDispatcher,
        UnsupportedTaskCleanupDispatcher,
        { provide: RULE_GENERATION_DISPATCHER, useExisting: UnsupportedRuleGenerationDispatcher },
        { provide: TITLE_SUGGESTION_DISPATCHER, useExisting: UnsupportedTitleSuggestionDispatcher },
        { provide: RECIPE_SCAN_DISPATCHER, useExisting: UnsupportedRecipeScanDispatcher },
        { provide: TASK_CLEANUP_DISPATCHER, useExisting: UnsupportedTaskCleanupDispatcher },
    ],
    exports: [RULE_GENERATION_DISPATCHER, TITLE_SUGGESTION_DISPATCHER, RECIPE_SCAN_DISPATCHER, TASK_CLEANUP_DISPATCHER],
})
export class WorkerDispatchModule {}
