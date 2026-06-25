import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RuleBackfillController } from "./api/rule.backfill.controller.js";
import { RuleBackfillService } from "./application/rule.backfill.service.js";
import { RuleBackfillWorker } from "./application/rule.backfill.worker.js";
import { GovernanceJobEntity } from "~governance/job/governance.job.entity.js";
import { GovernanceJobRepository } from "~governance/job/governance.job.repository.js";

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
    static register(
        databaseModule: DynamicModule,
        verificationModule: DynamicModule,
    ): DynamicModule {
        return {
            module: RuleBackfillModule,
            global: true,
            imports: [
                TypeOrmModule.forFeature([GovernanceJobEntity]),
                databaseModule,
                verificationModule,
            ],
            controllers: [RuleBackfillController],
            providers: [
                GovernanceJobRepository,
                RuleBackfillService,
                RuleBackfillWorker,
            ],
            exports: [RuleBackfillService],
        };
    }
}
