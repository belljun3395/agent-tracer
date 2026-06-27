import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaskRuleGenerationController } from "./api/task.rule.generation.controller.js";
import { TaskRuleGenerationService } from "./application/task.rule.generation.service.js";
import { GovernanceJobEntity } from "@monitor/governance/job/governance.job.entity.js";
import { GovernanceJobRepository } from "@monitor/governance/job/governance.job.repository.js";

@Module({})
export class RuleGenerationModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: RuleGenerationModule,
            global: true,
            imports: [
                TypeOrmModule.forFeature([GovernanceJobEntity]),
                databaseModule,
            ],
            controllers: [TaskRuleGenerationController],
            providers: [
                GovernanceJobRepository,
                TaskRuleGenerationService,
            ],
            exports: [TaskRuleGenerationService],
        };
    }
}
