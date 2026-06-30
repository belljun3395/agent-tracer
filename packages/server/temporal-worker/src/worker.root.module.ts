import { Module, type DynamicModule } from "@nestjs/common";
import { WorkerModule } from "@monitor/server-core/worker.module.js";
import type { ServerModuleOptions } from "@monitor/server-core/server.module.options.js";
import { LocalQueryRunner } from "@monitor/shared/llm/local.query.runner.js";
import { MessagesQueryRunner } from "@monitor/shared/llm/messages.query.runner.js";
import { WorkerDispatchModule } from "./dispatch.unsupported.js";
import { RuleSuggestionAgent } from "./agents/rule.suggestion.agent.js";
import { TitleSuggestionAgent } from "./agents/title.suggestion.agent.js";
import { RuleGenerationActivity } from "./activities/rule.generation.activity.js";
import { TitleSuggestionActivity } from "./activities/title.suggestion.activity.js";

// 워커 합성 루트: 도메인 그래프 + 에이전트·액티비티 + 실행 전용 디스패처 바인딩.
@Module({})
export class WorkerRootModule {
    static forRoot(options: ServerModuleOptions): DynamicModule {
        return {
            module: WorkerRootModule,
            imports: [WorkerModule.forRoot(options), WorkerDispatchModule],
            providers: [
                {
                    provide: RuleSuggestionAgent,
                    useFactory: () => new RuleSuggestionAgent(new LocalQueryRunner()),
                },
                {
                    provide: TitleSuggestionAgent,
                    useFactory: () => new TitleSuggestionAgent(new MessagesQueryRunner()),
                },
                RuleGenerationActivity,
                TitleSuggestionActivity,
            ],
            exports: [RuleGenerationActivity, TitleSuggestionActivity],
        };
    }
}
