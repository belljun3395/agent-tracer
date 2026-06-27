import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RuleBackfillController } from "./api/rule.backfill.controller.js";
import { RuleBackfillService } from "./application/rule.backfill.service.js";
import { RuleJobEntity } from "../job/rule.job.entity.js";
import { RuleJobRepository } from "../job/rule.job.repository.js";

/**
 * Rule backfill module — owns the `rule_backfill` governance job that runs a
 * rule's re-evaluation sweep asynchronously, off the request path.
 *
 * Depends on:
 *   - RULE_PERSISTENCE_PORT  ← rule module (global export) to fetch the rule
 *   - VERIFICATION_BACKFILL  ← verification module to run the sweep
 */
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
            ],
            exports: [RuleBackfillService],
        };
    }
}
