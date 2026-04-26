import type { Provider } from "@nestjs/common";
import type { IEventRepository, INotificationPublisher } from "~application/index.js";
import type { IRuleRepository } from "~application/ports/repository/rule.repository.js";
import type { IRuleEnforcementRepository } from "~application/ports/repository/rule.enforcement.repository.js";
import type { ITurnRepository } from "~application/ports/repository/turn.repository.js";
import type { IVerdictRepository } from "~application/ports/repository/verdict.repository.js";
import { RunTurnEvaluationUseCase } from "~application/verification/run.turn.evaluation.usecase.js";
import { RuleEnforcementPostProcessor } from "~application/verification/services/rule.enforcement.post.processor.js";
import { TurnEvaluationService } from "~application/verification/services/turn.evaluation.service.js";
import { TurnLifecyclePostProcessor } from "~application/verification/services/turn.lifecycle.post.processor.js";
import {
    EVENT_REPOSITORY_TOKEN,
    NOTIFICATION_PUBLISHER_TOKEN,
    RULE_ENFORCEMENT_REPOSITORY_TOKEN,
    RULE_REPOSITORY_TOKEN,
    TURN_REPOSITORY_TOKEN,
    VERDICT_REPOSITORY_TOKEN,
} from "../database/database.provider.js";

export const VERIFICATION_APPLICATION_PROVIDERS: Provider[] = [
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
];

export const VERIFICATION_APPLICATION_EXPORTS = [
    TurnEvaluationService,
    RunTurnEvaluationUseCase,
    RuleEnforcementPostProcessor,
    TurnLifecyclePostProcessor,
] as const;
