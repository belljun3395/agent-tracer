import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RULE_REPOSITORY_TOKEN } from "./public/tokens.js";
import { RuleController } from "./api/rule.controller.js";
import { RuleIngestController } from "./api/rule.ingest.controller.js";
import { TaskRulesQueryController } from "./api/task.rules.query.controller.js";
import { CreateRuleUseCase } from "./application/create.rule.usecase.js";
import { DeleteRuleUseCase } from "./application/delete.rule.usecase.js";
import {
    ListRulesForTaskUseCase,
    ListRulesUseCase,
} from "./application/list.rules.usecase.js";
import {
    BACKFILL_TRIGGER_PORT,
    NOTIFICATION_PUBLISHER_PORT,
    RULE_PERSISTENCE_PORT,
    VERIFICATION_INVALIDATION_PORT,
} from "./application/outbound/tokens.js";
import { DemoteRuleToTaskUseCase } from "./application/demote.rule.to.task.usecase.js";
import { PromoteRuleToGlobalUseCase } from "./application/promote.rule.to.global.usecase.js";
import { RegisterSuggestionUseCase } from "./application/register.suggestion.usecase.js";
import { UpdateRuleUseCase } from "./application/update.rule.usecase.js";
import { BackfillTriggerAdapter } from "./adapter/backfill.trigger.adapter.js";
import { RuleNotificationPublisherAdapter } from "./adapter/notification.publisher.adapter.js";
import { VerificationInvalidationAdapter } from "./adapter/verification.invalidation.adapter.js";
import { RuleEntity } from "./domain/rule.entity.js";
import {
    RULE_READ,
    RULE_SIGNATURE_QUERY,
    RULE_WRITE,
} from "./public/tokens.js";
import { RuleRepository } from "./repository/rule.repository.js";

/**
 * Rule module — owns RuleEntity (rules table).
 *
 * Persistence: TypeORM-backed RuleRepository implementing IRulePersistence.
 * RULE_REPOSITORY_TOKEN is remapped here to RuleRepository so legacy
 * factory bindings (verification module's TurnEvaluationService and
 * RuleEnforcementPostProcessor) keep working without changes.
 *
 * Public surface (consumed by verification + UI):
 *   - RULE_READ              ← RuleReadPublicAdapter
 *   - RULE_WRITE             ← RuleWritePublicAdapter
 *   - RULE_SIGNATURE_QUERY   ← RuleSignatureQueryPublicAdapter
 *
 * Outbound surface:
 *   - RULE_PERSISTENCE_PORT          ← TypeORM RuleRepository
 *   - NOTIFICATION_PUBLISHER_PORT    ← shared transport
 *   - BACKFILL_TRIGGER_PORT          ← verification.public IVerificationBackfill
 *   - VERIFICATION_INVALIDATION_PORT ← verification.public IVerdictInvalidation
 */
@Module({})
export class RuleModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: RuleModule,
            imports: [
                TypeOrmModule.forFeature([RuleEntity]),
                databaseModule,
            ],
            controllers: [
                RuleController,
                RuleIngestController,
                TaskRulesQueryController,
            ],
            providers: [
                RuleRepository,
                // Remap legacy RULE_REPOSITORY_TOKEN to the TypeORM repo so
                // verification module's factory bindings receive the new repo.
                { provide: RULE_REPOSITORY_TOKEN, useExisting: RuleRepository },
                // Outbound adapters
                BackfillTriggerAdapter,
                RuleNotificationPublisherAdapter,
                VerificationInvalidationAdapter,
                // Use cases
                CreateRuleUseCase,
                UpdateRuleUseCase,
                DeleteRuleUseCase,
                ListRulesUseCase,
                ListRulesForTaskUseCase,
                PromoteRuleToGlobalUseCase,
                DemoteRuleToTaskUseCase,
                RegisterSuggestionUseCase,
                // Public iservices — bound directly to RuleRepository (structurally compatible)
                { provide: RULE_READ, useExisting: RuleRepository },
                { provide: RULE_WRITE, useExisting: RuleRepository },
                { provide: RULE_SIGNATURE_QUERY, useExisting: RuleRepository },
                // Outbound bindings
                { provide: RULE_PERSISTENCE_PORT, useExisting: RuleRepository },
                { provide: NOTIFICATION_PUBLISHER_PORT, useExisting: RuleNotificationPublisherAdapter },
                { provide: BACKFILL_TRIGGER_PORT, useExisting: BackfillTriggerAdapter },
                { provide: VERIFICATION_INVALIDATION_PORT, useExisting: VerificationInvalidationAdapter },
            ],
            exports: [
                RULE_READ,
                RULE_WRITE,
                RULE_SIGNATURE_QUERY,
                RULE_REPOSITORY_TOKEN,
                ListRulesUseCase,
                RegisterSuggestionUseCase,
                // Consumed by the rule-backfill module's worker to load a rule
                // before running its re-evaluation sweep.
                RULE_PERSISTENCE_PORT,
            ],
        };
    }
}
