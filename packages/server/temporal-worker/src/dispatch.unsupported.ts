import { Global, Injectable, Module } from "@nestjs/common";
import {
    RULE_GENERATION_DISPATCHER,
    type IRuleGenerationDispatcher,
} from "@monitor/rules-api/rule/generation/application/outbound/rule.generation.dispatcher.port.js";
import {
    TITLE_SUGGESTION_DISPATCHER,
    type ITitleSuggestionDispatcher,
} from "@monitor/run-api/task/application/outbound/title.suggestion.dispatcher.port.js";

const MESSAGE = "temporal-worker executes jobs; it does not dispatch them.";

// 워커는 제출측 유스케이스를 부팅하지만 실제 dispatch는 게이트웨이만 한다.
// 호출되면 결선 오류이므로 즉시 실패시킨다.
@Injectable()
export class UnsupportedRuleGenerationDispatcher implements IRuleGenerationDispatcher {
    dispatch(): Promise<never> {
        throw new Error(MESSAGE);
    }
}

@Injectable()
export class UnsupportedTitleSuggestionDispatcher implements ITitleSuggestionDispatcher {
    dispatch(): Promise<never> {
        throw new Error(MESSAGE);
    }
}

@Global()
@Module({
    providers: [
        UnsupportedRuleGenerationDispatcher,
        UnsupportedTitleSuggestionDispatcher,
        {
            provide: RULE_GENERATION_DISPATCHER,
            useExisting: UnsupportedRuleGenerationDispatcher,
        },
        {
            provide: TITLE_SUGGESTION_DISPATCHER,
            useExisting: UnsupportedTitleSuggestionDispatcher,
        },
    ],
    exports: [RULE_GENERATION_DISPATCHER, TITLE_SUGGESTION_DISPATCHER],
})
export class WorkerDispatchModule {}
