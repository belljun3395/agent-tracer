import { Module, type DynamicModule } from "@nestjs/common";
import { RuleCommandController } from "./api/rule.command.controller.js";
import { RuleQueryController } from "./api/rule.query.controller.js";
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
    VERDICT_COUNT_QUERY_PORT,
    VERIFICATION_INVALIDATION_PORT,
} from "./application/outbound/tokens.js";
import { PromoteRuleToGlobalUseCase } from "./application/promote.rule.to.global.usecase.js";
import { ReEvaluateRuleUseCase } from "./application/re-evaluate.rule.usecase.js";
import { RegisterSuggestionUseCase } from "./application/register.suggestion.usecase.js";
import { UpdateRuleUseCase } from "./application/update.rule.usecase.js";
import { BackfillTriggerAdapter } from "./adapter/backfill.trigger.adapter.js";
import { RuleNotificationPublisherAdapter } from "./adapter/notification.publisher.adapter.js";
import { RuleReadPublicAdapter } from "./adapter/rule.read.public.adapter.js";
import { RuleSignatureQueryPublicAdapter } from "./adapter/rule.signature.query.public.adapter.js";
import { RuleWritePublicAdapter } from "./adapter/rule.write.public.adapter.js";
import { VerdictCountQueryAdapter } from "./adapter/verdict.count.query.adapter.js";
import { VerificationInvalidationAdapter } from "./adapter/verification.invalidation.adapter.js";
import {
    RULE_READ,
    RULE_SIGNATURE_QUERY,
    RULE_WRITE,
} from "./public/tokens.js";
import { RuleRepository } from "./repository/rule.repository.js";

/**
 * Rule module — owns the rules table (CRUD + suggestions + promotion).
 *
 * Persistence: legacy IRuleRepository wrapped by RuleRepository.
 *
 * Public surface (consumed by verification + UI):
 *   - RULE_READ              ← RuleReadPublicAdapter
 *   - RULE_WRITE             ← RuleWritePublicAdapter
 *   - RULE_SIGNATURE_QUERY   ← RuleSignatureQueryPublicAdapter
 *
 * Outbound surface:
 *   - RULE_PERSISTENCE_PORT          ← legacy SqliteRuleRepository wrap
 *   - NOTIFICATION_PUBLISHER_PORT    ← shared transport
 *   - BACKFILL_TRIGGER_PORT          ← legacy verification BackfillRuleEvaluation
 *   - VERIFICATION_INVALIDATION_PORT ← legacy IVerdictRepository + IRuleEnforcementRepository
 *   - VERDICT_COUNT_QUERY_PORT       ← legacy GetVerdictCountsForTaskUseCase
 */
@Module({})
export class RuleModule {
    static register(databaseModule: DynamicModule, verificationModule: DynamicModule): DynamicModule {
        return {
            module: RuleModule,
            global: true,
            imports: [databaseModule, verificationModule],
            controllers: [RuleCommandController, RuleQueryController, TaskRulesQueryController],
            providers: [
                RuleRepository,
                // Outbound adapters
                BackfillTriggerAdapter,
                RuleNotificationPublisherAdapter,
                VerdictCountQueryAdapter,
                VerificationInvalidationAdapter,
                // Public adapters
                RuleReadPublicAdapter,
                RuleSignatureQueryPublicAdapter,
                RuleWritePublicAdapter,
                // Use cases
                CreateRuleUseCase,
                UpdateRuleUseCase,
                DeleteRuleUseCase,
                ListRulesUseCase,
                ListRulesForTaskUseCase,
                PromoteRuleToGlobalUseCase,
                RegisterSuggestionUseCase,
                ReEvaluateRuleUseCase,
                // Public iservices
                { provide: RULE_READ, useExisting: RuleReadPublicAdapter },
                { provide: RULE_WRITE, useExisting: RuleWritePublicAdapter },
                { provide: RULE_SIGNATURE_QUERY, useExisting: RuleSignatureQueryPublicAdapter },
                // Outbound bindings
                { provide: RULE_PERSISTENCE_PORT, useExisting: RuleRepository },
                { provide: NOTIFICATION_PUBLISHER_PORT, useExisting: RuleNotificationPublisherAdapter },
                { provide: BACKFILL_TRIGGER_PORT, useExisting: BackfillTriggerAdapter },
                { provide: VERIFICATION_INVALIDATION_PORT, useExisting: VerificationInvalidationAdapter },
                { provide: VERDICT_COUNT_QUERY_PORT, useExisting: VerdictCountQueryAdapter },
            ],
            exports: [RULE_READ, RULE_WRITE, RULE_SIGNATURE_QUERY],
        };
    }
}
