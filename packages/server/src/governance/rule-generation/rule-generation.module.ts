import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RuleSuggestionAgent } from "~adapters/llm/rule.suggestion.agent.js";
import { TaskRuleGenerationController } from "./api/task.rule.generation.controller.js";
import { TaskRuleGenerationService } from "./application/task.rule.generation.service.js";
import { TaskRuleGenerationWorker } from "./application/task.rule.generation.worker.js";
import { TaskRuleGenerationJobEntity } from "./domain/task.rule.generation.job.entity.js";
import { TaskRuleGenerationJobRepository } from "./repository/task.rule.generation.job.repository.js";

@Module({})
export class RuleGenerationModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: RuleGenerationModule,
            global: true,
            imports: [
                TypeOrmModule.forFeature([TaskRuleGenerationJobEntity]),
                databaseModule,
            ],
            controllers: [TaskRuleGenerationController],
            providers: [
                TaskRuleGenerationJobRepository,
                TaskRuleGenerationService,
                TaskRuleGenerationWorker,
                RuleSuggestionAgent,
            ],
            exports: [TaskRuleGenerationService],
        };
    }
}
