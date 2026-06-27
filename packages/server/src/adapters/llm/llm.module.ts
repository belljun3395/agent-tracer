import { Global, Module } from "@nestjs/common";
import { RuleSuggestionAgent } from "./rule.suggestion.agent.js";
import { TaskCleanupAgent } from "./task.cleanup.agent.js";
import { TitleSuggestionAgent } from "./title.suggestion.agent.js";
import { RecipeScanAgent } from "./recipe.scan.agent.js";
import { LocalQueryRunner } from "./local.query.runner.js";
import { QUERY_RUNNER } from "./query.runner.port.js";

/**
 * Claude Agent SDK 에이전트(프롬프트 작성 + zod 파싱)와 쿼리 러너의 단일 모듈.
 * 에이전트는 `query()` 실행만 QUERY_RUNNER 에 위임하며, 러너는 서버 프로세스 안에서
 * 인라인으로 실행한다. Global 이라 기능 모듈이 별도 import 없이 에이전트를 주입한다.
 */
@Global()
@Module({
    providers: [
        RuleSuggestionAgent,
        TaskCleanupAgent,
        TitleSuggestionAgent,
        RecipeScanAgent,
        LocalQueryRunner,
        { provide: QUERY_RUNNER, useExisting: LocalQueryRunner },
    ],
    exports: [RuleSuggestionAgent, TaskCleanupAgent, TitleSuggestionAgent, RecipeScanAgent],
})
export class LlmModule {}
