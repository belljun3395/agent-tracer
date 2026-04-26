import { randomUUID } from "node:crypto";
import type { Provider } from "@nestjs/common";
import type { IRuleRepository } from "~application/ports/repository/rule.repository.js";
import type { IVerdictRepository } from "~application/ports/repository/verdict.repository.js";
import type { ITurnRepository } from "~application/ports/repository/turn.repository.js";
import type { IAppConfigRepository } from "~application/ports/repository/app.config.repository.js";
import type { ITurnQueryRepository } from "~application/ports/repository/turn.query.repository.js";
import { NodeNotifierAdapter } from "~adapters/notifications/node.notifier.adapter.js";
import { RunTurnEvaluationUseCase } from "~application/verification/run.turn.evaluation.usecase.js";
import { BackfillRuleEvaluationUseCase } from "~application/verification/backfill.rule.evaluation.usecase.js";
import { VerdictCountsUseCase } from "~application/verification/query/index.js";
import { NotifierService } from "~application/notifications/index.js";
import {
    APP_CONFIG_REPOSITORY_TOKEN,
    RULE_REPOSITORY_TOKEN,
    TURN_REPOSITORY_TOKEN,
    TURN_QUERY_REPOSITORY_TOKEN,
    VERDICT_REPOSITORY_TOKEN,
} from "../database/database.provider.js";

export const VERIFICATION_APPLICATION_PROVIDERS: Provider[] = [
    {
        provide: RunTurnEvaluationUseCase,
        useFactory: (
            ruleRepo: IRuleRepository,
            verdictRepo: IVerdictRepository,
            notifier: NotifierService,
        ) =>
            new RunTurnEvaluationUseCase({
                ruleRepo,
                verdictRepo,
                now: () => new Date().toISOString(),
                newVerdictId: () => randomUUID(),
                notifier,
            }),
        inject: [RULE_REPOSITORY_TOKEN, VERDICT_REPOSITORY_TOKEN, NotifierService],
    },
    {
        provide: VerdictCountsUseCase,
        useFactory: (verdictRepo: IVerdictRepository) =>
            new VerdictCountsUseCase({ verdictRepo }),
        inject: [VERDICT_REPOSITORY_TOKEN],
    },
    {
        provide: NotifierService,
        useFactory: (config: IAppConfigRepository) =>
            new NotifierService({
                os: new NodeNotifierAdapter(),
                config,
            }),
        inject: [APP_CONFIG_REPOSITORY_TOKEN],
    },
    {
        provide: BackfillRuleEvaluationUseCase,
        useFactory: (
            turnRepo: ITurnRepository,
            turnQueryRepo: ITurnQueryRepository,
            verdictRepo: IVerdictRepository,
        ) =>
            new BackfillRuleEvaluationUseCase({
                turnRepo,
                turnSource: turnQueryRepo,
                verdictRepo,
                now: () => new Date().toISOString(),
                newVerdictId: () => randomUUID(),
            }),
        inject: [TURN_REPOSITORY_TOKEN, TURN_QUERY_REPOSITORY_TOKEN, VERDICT_REPOSITORY_TOKEN],
    },
];

export const VERIFICATION_APPLICATION_EXPORTS = [
    RunTurnEvaluationUseCase,
    VerdictCountsUseCase,
    NotifierService,
    BackfillRuleEvaluationUseCase,
] as const;
