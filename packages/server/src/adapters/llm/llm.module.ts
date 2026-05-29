import { Global, Module } from "@nestjs/common";
import { RuleSuggestionAgent } from "./rule.suggestion.agent.js";
import { TaskCleanupAgent } from "./task.cleanup.agent.js";
import { TitleSuggestionAgent } from "./title.suggestion.agent.js";
import { RecipeScanAgent } from "./recipe.scan.agent.js";
import { LocalQueryRunner } from "./local.query.runner.js";
import { RemoteQueryRunner } from "./remote.query.runner.js";
import { LlmJobBroker } from "./llm.job.broker.js";
import { LlmJobController } from "./llm.job.controller.js";
import { QUERY_RUNNER, type IQueryRunner } from "./query.runner.port.js";

/**
 * Single home for LLM agents and their query runner. The four Claude Agent SDK
 * agents (prompt building + zod parsing) live here and delegate just the
 * `query()` execution to QUERY_RUNNER. Global so feature modules can inject the
 * agents without an explicit import. The agents are the seam consumers; the
 * query runner is internal to this module.
 *
 * Execution is chosen by MONITOR_LLM_RUNNER:
 *  - unset / "local" (default): {@link LocalQueryRunner} runs `query()` in the
 *    server process — correct when co-located with the workspace.
 *  - "remote": {@link RemoteQueryRunner} dispatches each query through
 *    {@link LlmJobBroker}; the local runtime daemon pulls it via
 *    {@link LlmJobController}, runs `query()` next to the workspace, posts back.
 */
@Global()
@Module({
    controllers: [LlmJobController],
    providers: [
        RuleSuggestionAgent,
        TaskCleanupAgent,
        TitleSuggestionAgent,
        RecipeScanAgent,
        LlmJobBroker,
        LocalQueryRunner,
        RemoteQueryRunner,
        {
            provide: QUERY_RUNNER,
            useFactory: (local: LocalQueryRunner, remote: RemoteQueryRunner): IQueryRunner =>
                (process.env["MONITOR_LLM_RUNNER"] ?? "local").trim().toLowerCase() === "remote"
                    ? remote
                    : local,
            inject: [LocalQueryRunner, RemoteQueryRunner],
        },
    ],
    exports: [RuleSuggestionAgent, TaskCleanupAgent, TitleSuggestionAgent, RecipeScanAgent],
})
export class LlmModule {}
