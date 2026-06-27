import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaskRuleGenerationController } from "./api/task.rule.generation.controller.js";
import { TaskRuleGenerationService } from "./application/task.rule.generation.service.js";
import { GovernanceJobEntity } from "@monitor/governance-api/job/governance.job.entity.js";
import { GovernanceJobRepository } from "@monitor/governance-api/job/governance.job.repository.js";
import { RuleSuggestionAgent } from "./application/rule.suggestion.agent.js";
import { LocalQueryRunner } from "@monitor/shared/llm/local.query.runner.js";
import { QUERY_RUNNER } from "@monitor/shared/llm/query.runner.port.js";

@Module({})
export class RuleGenerationModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: RuleGenerationModule,
            imports: [
                TypeOrmModule.forFeature([GovernanceJobEntity]),
                databaseModule,
            ],
            controllers: [TaskRuleGenerationController],
            providers: [
                GovernanceJobRepository,
                TaskRuleGenerationService,
                // 룰 생성 LLM 에이전트 + Claude SDK 쿼리 러너
                RuleSuggestionAgent,
                LocalQueryRunner,
                { provide: QUERY_RUNNER, useExisting: LocalQueryRunner },
            ],
            exports: [TaskRuleGenerationService],
        };
    }
}
