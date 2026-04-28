import { Module, type DynamicModule, type Provider } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import type { INotificationPublisher } from "~adapters/notifications/notification.publisher.port.js";
import type { IRuleAccess } from "~verification/application/outbound/rule.access.port.js";
import type { IRuleEnforcementRepository } from "~verification/application/outbound/rule.enforcement.repository.port.js";
import type { ITurnQueryRepository } from "~verification/application/outbound/turn.query.repository.port.js";
import type { ITurnRepository } from "~verification/application/outbound/turn.repository.port.js";
import type { IVerdictRepository } from "~verification/application/outbound/verdict.repository.port.js";
import type { ITimelineEventRead } from "~event/public/iservice/timeline.event.read.iservice.js";
import { TIMELINE_EVENT_READ } from "~event/public/tokens.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "~main/presentation/database/database.provider.js";
import { RULE_REPOSITORY_TOKEN } from "~rule/public/tokens.js";
import {
    RULE_ENFORCEMENT_REPOSITORY_TOKEN,
    TURN_REPOSITORY_TOKEN,
    VERDICT_REPOSITORY_TOKEN,
} from "./repository/tokens.js";
import { TURN_QUERY_REPOSITORY_TOKEN } from "./public/tokens.js";
import { VerificationBackfillPublicAdapter } from "./adapter/verification.backfill.public.adapter.js";
import { VerdictCountPublicAdapter } from "./adapter/verdict.count.public.adapter.js";
import { VerdictInvalidationPublicAdapter } from "./adapter/verdict.invalidation.public.adapter.js";
import { VerificationPostProcessorPublicAdapter } from "./adapter/verification.post.processor.public.adapter.js";
import { BackfillRuleEvaluationUseCase } from "./application/backfill.rule.evaluation.usecase.js";
import { GetVerdictCountsForTaskUseCase } from "./application/get.verdict.counts.for.task.usecase.js";
import { RunTurnEvaluationUseCase } from "./application/run.turn.evaluation.usecase.js";
import { RuleEnforcementEntity } from "./domain/rule.enforcement.entity.js";
import { TurnEntity } from "./domain/turn.entity.js";
import { TurnEventEntity } from "./domain/turn.event.entity.js";
import { VerdictEntity } from "./domain/verdict.entity.js";
import {
    VERIFICATION_BACKFILL,
    VERIFICATION_POST_PROCESSOR,
    VERIFICATION_VERDICT_COUNT,
    VERIFICATION_VERDICT_INVALIDATION,
} from "./public/tokens.js";
import { RuleEnforcementRepository } from "./repository/rule.enforcement.repository.js";
import { TurnRepository } from "./repository/turn.repository.js";
import { TurnQueryRepository } from "./repository/turn.query.repository.js";
import { VerdictRepository } from "./repository/verdict.repository.js";
import { RuleEnforcementPostProcessor } from "./service/rule.enforcement.post.processor.js";
import { TurnEvaluationService } from "./service/turn.evaluation.service.js";
import { TurnLifecyclePostProcessor } from "./service/turn.lifecycle.post.processor.js";

const VERIFICATION_INTERNAL_PROVIDERS: Provider[] = [
    {
        provide: TurnEvaluationService,
        useFactory: (
            ruleRepo: IRuleAccess,
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
            ruleRepo: IRuleAccess,
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
            eventRepo: ITimelineEventRead,
            turnRepo: ITurnRepository,
            turnEvaluation: TurnEvaluationService,
            notifier: INotificationPublisher,
        ) => new TurnLifecyclePostProcessor(eventRepo as never, turnRepo, turnEvaluation, notifier),
        inject: [
            TIMELINE_EVENT_READ,
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
            eventRepo: ITimelineEventRead,
            enforcementRepo: IRuleEnforcementRepository,
            notifier: INotificationPublisher,
        ) =>
            new BackfillRuleEvaluationUseCase({
                turnRepo,
                turnSource: turnQueryRepo,
                verdictRepo,
                eventRepo: eventRepo as never,
                enforcementRepo,
                notifier,
                now: () => new Date().toISOString(),
                newVerdictId: () => randomUUID(),
            }),
        inject: [
            TURN_REPOSITORY_TOKEN,
            TURN_QUERY_REPOSITORY_TOKEN,
            VERDICT_REPOSITORY_TOKEN,
            TIMELINE_EVENT_READ,
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
 * Persistence: TypeORM-backed entities (TurnEntity, TurnEventEntity,
 * VerdictEntity, RuleEnforcementEntity) with thin repositories. The legacy
 * DI tokens (TURN_REPOSITORY_TOKEN etc.) are remapped here to the new
 * TypeORM repos so existing factory bindings keep working without rewriting
 * the (legacy) post-processors and usecases.
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
            imports: [
                TypeOrmModule.forFeature([
                    TurnEntity,
                    TurnEventEntity,
                    VerdictEntity,
                    RuleEnforcementEntity,
                ]),
                databaseModule,
            ],
            providers: [
                // TypeORM-backed repositories
                TurnRepository,
                TurnQueryRepository,
                VerdictRepository,
                RuleEnforcementRepository,
                // Remap legacy DI tokens to the TypeORM repos so internal factory
                // bindings (TurnEvaluationService, post-processors, usecases) keep
                // working unchanged. This shadows the legacy DatabaseModule providers.
                { provide: TURN_REPOSITORY_TOKEN, useExisting: TurnRepository },
                { provide: TURN_QUERY_REPOSITORY_TOKEN, useExisting: TurnQueryRepository },
                { provide: VERDICT_REPOSITORY_TOKEN, useExisting: VerdictRepository },
                { provide: RULE_ENFORCEMENT_REPOSITORY_TOKEN, useExisting: RuleEnforcementRepository },
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
                // Cross-module-consumed token (task module reaches via public surface).
                TURN_QUERY_REPOSITORY_TOKEN,
                // Re-exported services for legacy consumers
                RunTurnEvaluationUseCase,
                TurnLifecyclePostProcessor,
                RuleEnforcementPostProcessor,
                TurnEvaluationService,
            ],
        };
    }
}
