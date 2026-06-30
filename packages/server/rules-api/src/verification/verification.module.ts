import { Module, type DynamicModule, type Provider } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import type { IRuleAccess } from "@monitor/rules-api/verification/application/outbound/rule.access.port.js";
import type { IRuleEnforcementRepository } from "@monitor/rules-api/verification/application/outbound/rule.enforcement.repository.port.js";
import type { ITurnQueryRepository } from "@monitor/rules-api/verification/application/outbound/turn.query.repository.port.js";
import type { ITurnRepository } from "@monitor/rules-api/verification/application/outbound/turn.repository.port.js";
import type { IVerdictRepository } from "@monitor/rules-api/verification/application/outbound/verdict.repository.port.js";
import type { ITimelineEventRead } from "@monitor/timeline-api/event/public/iservice/timeline.event.read.iservice.js";
import { TIMELINE_EVENT_READ } from "@monitor/timeline-api/event/public/tokens.js";
import type { IRuleRead } from "@monitor/rules-api/rule/public/iservice/rule.read.iservice.js";
import { RULE_READ, RULE_REPOSITORY_TOKEN } from "@monitor/rules-api/rule/public/tokens.js";
import {
    RULE_ENFORCEMENT_REPOSITORY_TOKEN,
    TURN_REPOSITORY_TOKEN,
    VERDICT_REPOSITORY_TOKEN,
} from "./repository/tokens.js";
import { TURN_QUERY_REPOSITORY_TOKEN } from "@monitor/run-api/task/public/tokens.js";
import { RuleEvidenceQueryController } from "./api/rule.evidence.query.controller.js";
import { VerdictInvalidationPublicAdapter } from "./adapter/verdict.invalidation.public.adapter.js";
import { VerificationPostProcessorPublicAdapter } from "./adapter/verification.post.processor.public.adapter.js";
import { EventRecordedVerificationSubscriber } from "./subscriber/event.recorded.verification.subscriber.js";
import { BackfillRuleEvaluationUseCase } from "./application/backfill.rule.evaluation.usecase.js";
import { GetRuleEvidenceForTaskUseCase } from "./application/get.rule.evidence.usecase.js";
import { RunTurnEvaluationUseCase } from "./application/run.turn.evaluation.usecase.js";
import { RuleEnforcementEntity } from "./domain/rule.enforcement.entity.js";
import { TurnEntity } from "./domain/turn.entity.js";
import { TurnEventEntity } from "./domain/turn.event.entity.js";
import { VerdictEntity } from "./domain/verdict.entity.js";
import {
    VERIFICATION_POST_PROCESSOR,
    VERIFICATION_VERDICT_INVALIDATION,
} from "./public/tokens.js";
import { RuleEnforcementRepository } from "./repository/rule.enforcement.repository.js";
import { TurnRepository } from "./repository/turn.repository.js";
import { TurnQueryRepository } from "./repository/turn.query.repository.js";
import { VerdictRepository } from "./repository/verdict.repository.js";
import { TurnEvaluationService } from "./service/turn.evaluation.service.js";

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
                eventRepo,
                enforcementRepo,
                notifier,
                now: () => new Date().toISOString(),
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
        provide: GetRuleEvidenceForTaskUseCase,
        useFactory: (
            enforcementRepo: IRuleEnforcementRepository,
            eventRead: ITimelineEventRead,
            ruleRead: IRuleRead,
        ) => new GetRuleEvidenceForTaskUseCase(enforcementRepo, eventRead, ruleRead),
        inject: [RULE_ENFORCEMENT_REPOSITORY_TOKEN, TIMELINE_EVENT_READ, RULE_READ],
    },
];

@Module({})
export class VerificationModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: VerificationModule,
            imports: [
                TypeOrmModule.forFeature([
                    TurnEntity,
                    TurnEventEntity,
                    VerdictEntity,
                    RuleEnforcementEntity,
                ]),
                databaseModule,
            ],
            controllers: [RuleEvidenceQueryController],
            providers: [

                TurnRepository,
                TurnQueryRepository,
                VerdictRepository,
                RuleEnforcementRepository,

                { provide: TURN_REPOSITORY_TOKEN, useExisting: TurnRepository },
                { provide: TURN_QUERY_REPOSITORY_TOKEN, useExisting: TurnQueryRepository },
                { provide: VERDICT_REPOSITORY_TOKEN, useExisting: VerdictRepository },
                { provide: RULE_ENFORCEMENT_REPOSITORY_TOKEN, useExisting: RuleEnforcementRepository },
                ...VERIFICATION_INTERNAL_PROVIDERS,

                VerdictInvalidationPublicAdapter,
                VerificationPostProcessorPublicAdapter,

                EventRecordedVerificationSubscriber,

                { provide: VERIFICATION_VERDICT_INVALIDATION, useExisting: VerdictInvalidationPublicAdapter },
                { provide: VERIFICATION_POST_PROCESSOR, useExisting: VerificationPostProcessorPublicAdapter },
            ],
            exports: [
                VERIFICATION_VERDICT_INVALIDATION,
                VERIFICATION_POST_PROCESSOR,

                TURN_QUERY_REPOSITORY_TOKEN,

                RunTurnEvaluationUseCase,
                TurnEvaluationService,
                BackfillRuleEvaluationUseCase,
            ],
        };
    }
}
