import type { Provider } from "@nestjs/common";
import type { IEventRepository, INotificationPublisher } from "~application/index.js";
import type { IRuleRepository } from "~application/ports/repository/rule.repository.js";
import type { IRuleEnforcementRepository } from "~application/ports/repository/rule.enforcement.repository.js";
import type { ITurnRepository } from "~application/ports/repository/turn.repository.js";
import type { ITurnQueryRepository } from "~application/ports/repository/turn.query.repository.js";
import type { IVerdictRepository } from "~application/ports/repository/verdict.repository.js";
import {
    CreateRuleUseCase,
    DeleteRuleUseCase,
    ListRulesForTaskUseCase,
    ListRulesUseCase,
    PromoteRuleToGlobalUseCase,
    RegisterSuggestionUseCase,
    UpdateRuleUseCase,
} from "~application/rules/index.js";
import { BackfillRuleEvaluationUseCase } from "~application/verification/backfill.rule.evaluation.usecase.js";
import { GetVerdictCountsForTaskUseCase } from "~application/verification/get.verdict.counts.for.task.usecase.js";
import {
    EVENT_REPOSITORY_TOKEN,
    NOTIFICATION_PUBLISHER_TOKEN,
    RULE_ENFORCEMENT_REPOSITORY_TOKEN,
    RULE_REPOSITORY_TOKEN,
    TURN_QUERY_REPOSITORY_TOKEN,
    TURN_REPOSITORY_TOKEN,
    VERDICT_REPOSITORY_TOKEN,
} from "../database/database.provider.js";

import { randomUUID } from "node:crypto";

export const RULES_APPLICATION_PROVIDERS: Provider[] = [
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
        provide: CreateRuleUseCase,
        useFactory: (
            ruleRepo: IRuleRepository,
            notifier: INotificationPublisher,
            backfill: BackfillRuleEvaluationUseCase,
        ) => new CreateRuleUseCase(ruleRepo, notifier, backfill),
        inject: [RULE_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN, BackfillRuleEvaluationUseCase],
    },
    {
        provide: UpdateRuleUseCase,
        useFactory: (
            ruleRepo: IRuleRepository,
            verdictRepo: IVerdictRepository,
            enforcementRepo: IRuleEnforcementRepository,
            notifier: INotificationPublisher,
        ) => new UpdateRuleUseCase(ruleRepo, verdictRepo, enforcementRepo, notifier),
        inject: [
            RULE_REPOSITORY_TOKEN,
            VERDICT_REPOSITORY_TOKEN,
            RULE_ENFORCEMENT_REPOSITORY_TOKEN,
            NOTIFICATION_PUBLISHER_TOKEN,
        ],
    },
    {
        provide: DeleteRuleUseCase,
        useFactory: (ruleRepo: IRuleRepository, notifier: INotificationPublisher) =>
            new DeleteRuleUseCase(ruleRepo, notifier),
        inject: [RULE_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
    },
    {
        provide: ListRulesUseCase,
        useFactory: (ruleRepo: IRuleRepository) => new ListRulesUseCase(ruleRepo),
        inject: [RULE_REPOSITORY_TOKEN],
    },
    {
        provide: ListRulesForTaskUseCase,
        useFactory: (ruleRepo: IRuleRepository) => new ListRulesForTaskUseCase(ruleRepo),
        inject: [RULE_REPOSITORY_TOKEN],
    },
    {
        provide: PromoteRuleToGlobalUseCase,
        useFactory: (
            ruleRepo: IRuleRepository,
            createRule: CreateRuleUseCase,
            deleteRule: DeleteRuleUseCase,
        ) =>
            new PromoteRuleToGlobalUseCase(
                ruleRepo,
                createRule,
                deleteRule,
            ),
        inject: [
            RULE_REPOSITORY_TOKEN,
            CreateRuleUseCase,
            DeleteRuleUseCase,
        ],
    },
    {
        provide: RegisterSuggestionUseCase,
        useFactory: (ruleRepo: IRuleRepository, createRule: CreateRuleUseCase) =>
            new RegisterSuggestionUseCase(ruleRepo, createRule),
        inject: [RULE_REPOSITORY_TOKEN, CreateRuleUseCase],
    },
    {
        provide: GetVerdictCountsForTaskUseCase,
        useFactory: (turnQueryRepo: ITurnQueryRepository) =>
            new GetVerdictCountsForTaskUseCase(turnQueryRepo),
        inject: [TURN_QUERY_REPOSITORY_TOKEN],
    },
];

export const RULES_APPLICATION_EXPORTS = [
    BackfillRuleEvaluationUseCase,
    CreateRuleUseCase,
    UpdateRuleUseCase,
    DeleteRuleUseCase,
    ListRulesUseCase,
    ListRulesForTaskUseCase,
    PromoteRuleToGlobalUseCase,
    RegisterSuggestionUseCase,
    GetVerdictCountsForTaskUseCase,
] as const;
