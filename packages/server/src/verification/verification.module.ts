import { Module, type DynamicModule, type Provider } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { INotificationPublisher } from "~application/ports/event/notification.publisher.js";
import type { IEventRepository } from "~application/ports/repository/event.repository.js";
import type { IRuleRepository } from "~application/ports/repository/rule.repository.js";
import type { IRuleEnforcementRepository } from "~application/ports/repository/rule.enforcement.repository.js";
import type { ITurnQueryRepository } from "~application/ports/repository/turn.query.repository.js";
import type { ITurnRepository } from "~application/ports/repository/turn.repository.js";
import type { IVerdictRepository } from "~application/ports/repository/verdict.repository.js";
import {
    EVENT_REPOSITORY_TOKEN,
    NOTIFICATION_PUBLISHER_TOKEN,
    RULE_ENFORCEMENT_REPOSITORY_TOKEN,
    RULE_REPOSITORY_TOKEN,
    TURN_QUERY_REPOSITORY_TOKEN,
    TURN_REPOSITORY_TOKEN,
    VERDICT_REPOSITORY_TOKEN,
} from "~main/presentation/database/database.provider.js";
import { VerificationBackfillPublicAdapter } from "./adapter/verification.backfill.public.adapter.js";
import { VerdictCountPublicAdapter } from "./adapter/verdict.count.public.adapter.js";
import { VerdictInvalidationPublicAdapter } from "./adapter/verdict.invalidation.public.adapter.js";
import { VerificationPostProcessorPublicAdapter } from "./adapter/verification.post.processor.public.adapter.js";
import { BackfillRuleEvaluationUseCase } from "./application/backfill.rule.evaluation.usecase.js";
import { GetVerdictCountsForTaskUseCase } from "./application/get.verdict.counts.for.task.usecase.js";
import { RunTurnEvaluationUseCase } from "./application/run.turn.evaluation.usecase.js";
import {
    VERIFICATION_BACKFILL,
    VERIFICATION_POST_PROCESSOR,
    VERIFICATION_VERDICT_COUNT,
    VERIFICATION_VERDICT_INVALIDATION,
} from "./public/tokens.js";
import { RuleEnforcementPostProcessor } from "./service/rule.enforcement.post.processor.js";
import { TurnEvaluationService } from "./service/turn.evaluation.service.js";
import { TurnLifecyclePostProcessor } from "./service/turn.lifecycle.post.processor.js";

const VERIFICATION_INTERNAL_PROVIDERS: Provider[] = [
    {
        provide: TurnEvaluationService,
        useFactory: (
            ruleRepo: IRuleRepository,
            turnRepo: ITurnRepository,
            verdictRepo: IVerdictRepository,
        ) => new TurnEvaluationService(ruleRepo, turnRepo, verdictRepo),
        inject: [RULE_REPOSITORY_TOKEN, TURN_REPOSITORY_TOKEN, VERDICT_REPOSITORY_TOKEN],
    },
    {
        provide: RunTurnEvaluationUseCase,
        useFactory: (turnEvaluation: TurnEvaluationService) =>
            new RunTurnEvaluationUseCase(turnEvaluation),
        inject: [TurnEvaluationService],
    },
    {
        provide: RuleEnforcementPostProcessor,
        useFactory: (
            ruleRepo: IRuleRepository,
            turnRepo: ITurnRepository,
            enforcementRepo: IRuleEnforcementRepository,
            notifier: INotificationPublisher,
        ) => new RuleEnforcementPostProcessor(ruleRepo, turnRepo, enforcementRepo, notifier),
        inject: [
            RULE_REPOSITORY_TOKEN,
            TURN_REPOSITORY_TOKEN,
            RULE_ENFORCEMENT_REPOSITORY_TOKEN,
            NOTIFICATION_PUBLISHER_TOKEN,
        ],
    },
    {
        provide: TurnLifecyclePostProcessor,
        useFactory: (
            eventRepo: IEventRepository,
            turnRepo: ITurnRepository,
            turnEvaluation: TurnEvaluationService,
            notifier: INotificationPublisher,
        ) => new TurnLifecyclePostProcessor(eventRepo, turnRepo, turnEvaluation, notifier),
        inject: [
            EVENT_REPOSITORY_TOKEN,
            TURN_REPOSITORY_TOKEN,
            TurnEvaluationService,
            NOTIFICATION_PUBLISHER_TOKEN,
        ],
    },
    {
        provide: BackfillRuleEvaluationUseCase,
        useFactory: (
            turnRepo: ITurnRepository,
            turnQueryRepo: ITurnQueryRepository,
            verdictRepo: IVerdictRepository,
            eventRepo: IEventRepository,
            enforcementRepo: IRuleEnforcementRepository,
            notifier: INotificationPublisher,
        ) =>
            new BackfillRuleEvaluationUseCase({
                turnRepo,
                turnSource: turnQueryRepo,
                verdictRepo,
                eventRepo,
                enforcementRepo,
                notifier,
                now: () => new Date().toISOString(),
                newVerdictId: () => randomUUID(),
            }),
        inject: [
            TURN_REPOSITORY_TOKEN,
            TURN_QUERY_REPOSITORY_TOKEN,
            VERDICT_REPOSITORY_TOKEN,
            EVENT_REPOSITORY_TOKEN,
            RULE_ENFORCEMENT_REPOSITORY_TOKEN,
            NOTIFICATION_PUBLISHER_TOKEN,
        ],
    },
    {
        provide: GetVerdictCountsForTaskUseCase,
        useFactory: (turnQueryRepo: ITurnQueryRepository) =>
            new GetVerdictCountsForTaskUseCase(turnQueryRepo),
        inject: [TURN_QUERY_REPOSITORY_TOKEN],
    },
];

/**
 * Verification module — owns turn evaluation, verdicts, and rule enforcement.
 *
 * Persistence: legacy SQLite repositories (turns, verdicts, rule_enforcements,
 * turn_query) bound via factory providers using the legacy DI tokens. Future
 * TypeORM migration replaces these factories with module-internal entities
 * + thin repos.
 *
 * Public surface:
 *   - VERIFICATION_BACKFILL              ← VerificationBackfillPublicAdapter
 *   - VERIFICATION_VERDICT_COUNT         ← VerdictCountPublicAdapter
 *   - VERIFICATION_POST_PROCESSOR        ← VerificationPostProcessorPublicAdapter
 *   - VERIFICATION_VERDICT_INVALIDATION  ← VerdictInvalidationPublicAdapter
 */
@Module({})
export class VerificationModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: VerificationModule,
            global: true,
            imports: [databaseModule],
            providers: [
                ...VERIFICATION_INTERNAL_PROVIDERS,
                // Public adapters
                VerificationBackfillPublicAdapter,
                VerdictCountPublicAdapter,
                VerdictInvalidationPublicAdapter,
                VerificationPostProcessorPublicAdapter,
                // Public iservice bindings
                { provide: VERIFICATION_BACKFILL, useExisting: VerificationBackfillPublicAdapter },
                { provide: VERIFICATION_VERDICT_COUNT, useExisting: VerdictCountPublicAdapter },
                { provide: VERIFICATION_VERDICT_INVALIDATION, useExisting: VerdictInvalidationPublicAdapter },
                { provide: VERIFICATION_POST_PROCESSOR, useExisting: VerificationPostProcessorPublicAdapter },
            ],
            exports: [
                VERIFICATION_BACKFILL,
                VERIFICATION_VERDICT_COUNT,
                VERIFICATION_VERDICT_INVALIDATION,
                VERIFICATION_POST_PROCESSOR,
                // Re-exported for legacy consumers (e.g. turn-partitions module)
                RunTurnEvaluationUseCase,
                TurnLifecyclePostProcessor,
                RuleEnforcementPostProcessor,
                TurnEvaluationService,
            ],
        };
    }
}
