import { Module, type DynamicModule, type Provider } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

// ── cross-api tokens ──────────────────────────────────────────────────────────
import { NOTIFICATION_PUBLISHER_TOKEN } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { TIMELINE_EVENT_READ } from "@monitor/timeline-api/public/tokens.js";
import { TASK_SUMMARY } from "@monitor/run-api/public/task/tokens.js";
import { TURN_QUERY_REPOSITORY_TOKEN } from "@monitor/run-api/public/task/tokens.js";

// ── entities ──────────────────────────────────────────────────────────────────
import { RuleEntity } from "./domain/rule/rule.entity.js";
import { TurnEntity } from "./domain/verification/turn.entity.js";
import { TurnEventEntity } from "./domain/verification/turn.event.entity.js";
import { VerdictEntity } from "./domain/verification/verdict.entity.js";
import { RuleEnforcementEntity } from "./domain/verification/rule.enforcement.entity.js";
import { RuleJobEntity } from "./domain/job/rule.job.entity.js";

// ── repositories ──────────────────────────────────────────────────────────────
import { RuleRepository } from "./repository/rule/rule.repository.js";
import { TurnRepository } from "./repository/verification/turn.repository.js";
import { TurnQueryRepository } from "./repository/verification/turn.query.repository.js";
import { VerdictRepository } from "./repository/verification/verdict.repository.js";
import { RuleEnforcementRepository } from "./repository/verification/rule.enforcement.repository.js";
import { RuleJobRepository } from "./repository/job/rule.job.repository.js";

// ── adapters ──────────────────────────────────────────────────────────────────
import { RuleNotificationPublisherAdapter } from "./adapter/rule/notification.publisher.adapter.js";
import { VerdictInvalidationPublicAdapter } from "./adapter/verification/verdict.invalidation.public.adapter.js";
import { VerificationPostProcessorPublicAdapter } from "./adapter/verification/verification.post.processor.public.adapter.js";

// ── services ──────────────────────────────────────────────────────────────────
import { TurnEvaluationService } from "./service/verification/turn.evaluation.service.js";
import { RuleBackfillService } from "./service/backfill/rule.backfill.service.js";
import { TaskRuleGenerationService } from "./service/generation/task.rule.generation.service.js";

// ── use cases: rule ───────────────────────────────────────────────────────────
import { CreateRuleUseCase } from "./application/rule/create.rule.usecase.js";
import { UpdateRuleUseCase } from "./application/rule/update.rule.usecase.js";
import { DeleteRuleUseCase } from "./application/rule/delete.rule.usecase.js";
import { ListRulesUseCase, ListRulesForTaskUseCase } from "./application/rule/list.rules.usecase.js";
import { PromoteRuleToGlobalUseCase } from "./application/rule/promote.rule.to.global.usecase.js";
import { DemoteRuleToTaskUseCase } from "./application/rule/demote.rule.to.task.usecase.js";
import { RegisterSuggestionUseCase } from "./application/rule/register.suggestion.usecase.js";

// ── use cases: verification ───────────────────────────────────────────────────
import { RunTurnEvaluationUseCase } from "./application/verification/run.turn.evaluation.usecase.js";
import { BackfillRuleEvaluationUseCase } from "./application/verification/backfill.rule.evaluation.usecase.js";
import { GetRuleEvidenceForTaskUseCase } from "./application/verification/get.rule.evidence.usecase.js";

// ── use cases: backfill ───────────────────────────────────────────────────────
import { EnqueueRuleBackfillUseCase } from "./application/backfill/enqueue.rule.backfill.usecase.js";

// ── use cases: generation ─────────────────────────────────────────────────────
import { EnqueueTaskRuleGenerationUseCase } from "./application/generation/enqueue.task.rule.generation.usecase.js";
import { GetLatestTaskRuleGenerationUseCase } from "./application/generation/get.latest.task.rule.generation.usecase.js";

// ── controllers ───────────────────────────────────────────────────────────────
import { RuleController } from "./api/rule/rule.controller.js";
import { RuleIngestController } from "./api/rule/rule.ingest.controller.js";
import { TaskRulesQueryController } from "./api/rule/task.rules.query.controller.js";
import { RuleEvidenceQueryController } from "./api/verification/rule.evidence.query.controller.js";
import { RuleBackfillController } from "./api/backfill/rule.backfill.controller.js";
import { TaskRuleGenerationController } from "./api/generation/task.rule.generation.controller.js";

// ── subscriber ────────────────────────────────────────────────────────────────
import { EventRecordedVerificationSubscriber } from "./subscriber/verification/event.recorded.verification.subscriber.js";

// ── public tokens ─────────────────────────────────────────────────────────────
import { RULE_READ, RULE_WRITE, RULE_SIGNATURE_QUERY } from "./public/rule/tokens.js";
import { VERIFICATION_VERDICT_INVALIDATION, VERIFICATION_POST_PROCESSOR } from "./public/verification/tokens.js";
import type { ITimelineEventRead } from "@monitor/timeline-api/public/iservice/timeline.event.read.iservice.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import type { ITaskSummary } from "@monitor/run-api/public/task/iservice/task.summary.iservice.js";

const VERIFICATION_PROVIDERS: Provider[] = [
    TurnRepository,
    TurnQueryRepository,
    VerdictRepository,
    RuleEnforcementRepository,
    {
        provide: TurnEvaluationService,
        useFactory: (ruleRepo: RuleRepository, turnRepo: TurnRepository, verdictRepo: VerdictRepository) =>
            new TurnEvaluationService(ruleRepo, turnRepo, verdictRepo),
        inject: [RuleRepository, TurnRepository, VerdictRepository],
    },
    {
        provide: RunTurnEvaluationUseCase,
        useFactory: (svc: TurnEvaluationService) => new RunTurnEvaluationUseCase(svc),
        inject: [TurnEvaluationService],
    },
    {
        provide: BackfillRuleEvaluationUseCase,
        useFactory: (
            turnRepo: TurnRepository,
            turnQueryRepo: TurnQueryRepository,
            verdictRepo: VerdictRepository,
            eventRepo: ITimelineEventRead,
            enforcementRepo: RuleEnforcementRepository,
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
            TurnRepository,
            TurnQueryRepository,
            VerdictRepository,
            TIMELINE_EVENT_READ,
            RuleEnforcementRepository,
            NOTIFICATION_PUBLISHER_TOKEN,
        ],
    },
    {
        provide: GetRuleEvidenceForTaskUseCase,
        useFactory: (
            enforcementRepo: RuleEnforcementRepository,
            eventRead: ITimelineEventRead,
            ruleRepo: RuleRepository,
        ) => new GetRuleEvidenceForTaskUseCase(enforcementRepo, eventRead, ruleRepo),
        inject: [RuleEnforcementRepository, TIMELINE_EVENT_READ, RuleRepository],
    },
    VerdictInvalidationPublicAdapter,
    VerificationPostProcessorPublicAdapter,
    EventRecordedVerificationSubscriber,
    { provide: VERIFICATION_VERDICT_INVALIDATION, useExisting: VerdictInvalidationPublicAdapter },
    { provide: VERIFICATION_POST_PROCESSOR, useExisting: VerificationPostProcessorPublicAdapter },
    { provide: TURN_QUERY_REPOSITORY_TOKEN, useExisting: TurnQueryRepository },
];

@Module({})
export class RulesModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: RulesModule,
            imports: [
                TypeOrmModule.forFeature([
                    RuleEntity,
                    TurnEntity,
                    TurnEventEntity,
                    VerdictEntity,
                    RuleEnforcementEntity,
                    RuleJobEntity,
                ]),
                databaseModule,
            ],
            controllers: [
                RuleController,
                RuleIngestController,
                TaskRulesQueryController,
                RuleEvidenceQueryController,
                RuleBackfillController,
                TaskRuleGenerationController,
            ],
            providers: [
                // ── rule ──
                RuleRepository,
                RuleNotificationPublisherAdapter,
                CreateRuleUseCase,
                UpdateRuleUseCase,
                DeleteRuleUseCase,
                ListRulesUseCase,
                ListRulesForTaskUseCase,
                PromoteRuleToGlobalUseCase,
                DemoteRuleToTaskUseCase,
                RegisterSuggestionUseCase,
                { provide: RULE_READ, useExisting: RuleRepository },
                { provide: RULE_WRITE, useExisting: RuleRepository },
                { provide: RULE_SIGNATURE_QUERY, useExisting: RuleRepository },

                // ── verification ──
                ...VERIFICATION_PROVIDERS,

                // ── backfill ──
                RuleJobRepository,
                RuleBackfillService,
                EnqueueRuleBackfillUseCase,

                // ── generation ──
                {
                    provide: TaskRuleGenerationService,
                    useFactory: (jobs: RuleJobRepository, taskSummary: ITaskSummary) =>
                        new TaskRuleGenerationService(jobs, taskSummary),
                    inject: [RuleJobRepository, TASK_SUMMARY],
                },
                EnqueueTaskRuleGenerationUseCase,
                GetLatestTaskRuleGenerationUseCase,
            ],
            exports: [
                // rule cross-api
                RULE_READ,
                RULE_WRITE,
                RULE_SIGNATURE_QUERY,
                ListRulesUseCase,
                RegisterSuggestionUseCase,

                // verification cross-api
                VERIFICATION_VERDICT_INVALIDATION,
                VERIFICATION_POST_PROCESSOR,
                TURN_QUERY_REPOSITORY_TOKEN,
                RunTurnEvaluationUseCase,
                TurnEvaluationService,
                BackfillRuleEvaluationUseCase,

                // generation cross-api
                RuleJobRepository,
            ],
        };
    }
}
