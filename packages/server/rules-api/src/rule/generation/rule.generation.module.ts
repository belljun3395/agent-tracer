import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaskRuleGenerationController } from "./api/task.rule.generation.controller.js";
import { TaskRuleGenerationService } from "./service/task.rule.generation.service.js";
import { EnqueueTaskRuleGenerationUseCase } from "./application/enqueue.task.rule.generation.usecase.js";
import { GetLatestTaskRuleGenerationUseCase } from "./application/get.latest.task.rule.generation.usecase.js";
import { RuleJobEntity } from "../../job/rule.job.entity.js";
import { RuleJobRepository } from "../../job/rule.job.repository.js";
import { RuleSuggestionAgent } from "./agent/rule.suggestion.agent.js";
import { LocalQueryRunner } from "@monitor/shared/llm/local.query.runner.js";
import { QUERY_RUNNER } from "@monitor/shared/llm/query.runner.port.js";

@Module({})
export class RuleGenerationModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: RuleGenerationModule,
            imports: [
                TypeOrmModule.forFeature([RuleJobEntity]),
                databaseModule,
            ],
            controllers: [TaskRuleGenerationController],
            providers: [
                RuleJobRepository,
                TaskRuleGenerationService,
                EnqueueTaskRuleGenerationUseCase,
                GetLatestTaskRuleGenerationUseCase,

                RuleSuggestionAgent,
                LocalQueryRunner,
                { provide: QUERY_RUNNER, useExisting: LocalQueryRunner },
            ],
            exports: [],
        };
    }
}
