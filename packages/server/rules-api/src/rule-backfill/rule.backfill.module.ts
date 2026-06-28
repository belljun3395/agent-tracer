import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RuleBackfillController } from "./api/rule.backfill.controller.js";
import { RuleBackfillService } from "./service/rule.backfill.service.js";
import { EnqueueRuleBackfillUseCase } from "./application/enqueue.rule.backfill.usecase.js";
import { RuleJobEntity } from "../job/rule.job.entity.js";
import { RuleJobRepository } from "../job/rule.job.repository.js";

@Module({})
export class RuleBackfillModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: RuleBackfillModule,
            imports: [
                TypeOrmModule.forFeature([RuleJobEntity]),
                databaseModule,
            ],
            controllers: [RuleBackfillController],
            providers: [
                RuleJobRepository,
                RuleBackfillService,
                EnqueueRuleBackfillUseCase,
            ],
            exports: [],
        };
    }
}
