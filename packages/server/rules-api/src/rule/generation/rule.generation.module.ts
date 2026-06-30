import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaskRuleGenerationController } from "./api/task.rule.generation.controller.js";
import { TaskRuleGenerationService } from "./service/task.rule.generation.service.js";
import { EnqueueTaskRuleGenerationUseCase } from "./application/enqueue.task.rule.generation.usecase.js";
import { GetLatestTaskRuleGenerationUseCase } from "./application/get.latest.task.rule.generation.usecase.js";
import { RuleJobEntity } from "../../job/rule.job.entity.js";
import { RuleJobRepository } from "../../job/rule.job.repository.js";

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
            ],
            exports: [RuleJobRepository],
        };
    }
}
