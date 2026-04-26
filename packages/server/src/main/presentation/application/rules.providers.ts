import { randomUUID } from "node:crypto";
import type { Provider } from "@nestjs/common";
import type { IRuleRepository } from "~application/ports/repository/rule.repository.js";
import {
    ClassifyTerminalLaneUseCase,
    CreateRuleUseCase,
    DeleteRuleUseCase,
    ListRulesUseCase,
    PromoteRuleToGlobalUseCase,
    RegisterSuggestionUseCase,
    UpdateRuleUseCase,
} from "~application/rules/index.js";
import { BackfillRuleEvaluationUseCase } from "~application/verification/backfill.rule.evaluation.usecase.js";
import { RULE_REPOSITORY_TOKEN } from "../database/database.provider.js";

function nowIso(): string {
    return new Date().toISOString();
}

function randomId(): string {
    return randomUUID();
}

export const RULES_APPLICATION_PROVIDERS: Provider[] = [
    {
        provide: CreateRuleUseCase,
        useFactory: (ruleRepo: IRuleRepository) =>
            new CreateRuleUseCase({ ruleRepo, newId: randomId, now: nowIso }),
        inject: [RULE_REPOSITORY_TOKEN],
    },
    {
        provide: DeleteRuleUseCase,
        useFactory: (ruleRepo: IRuleRepository) => new DeleteRuleUseCase(ruleRepo),
        inject: [RULE_REPOSITORY_TOKEN],
    },
    {
        provide: ListRulesUseCase,
        useFactory: (ruleRepo: IRuleRepository) => new ListRulesUseCase(ruleRepo),
        inject: [RULE_REPOSITORY_TOKEN],
    },
    {
        provide: RegisterSuggestionUseCase,
        useFactory: (ruleRepo: IRuleRepository, backfill: BackfillRuleEvaluationUseCase) =>
            new RegisterSuggestionUseCase({
                ruleRepo,
                newId: randomId,
                now: nowIso,
                dashboardBaseUrl:
                    process.env["DASHBOARD_BASE_URL"] ?? "http://localhost:5173",
                backfill: (rule) => backfill.execute(rule).then(() => undefined),
            }),
        inject: [RULE_REPOSITORY_TOKEN, BackfillRuleEvaluationUseCase],
    },
    {
        provide: UpdateRuleUseCase,
        useFactory: (ruleRepo: IRuleRepository) => new UpdateRuleUseCase({ ruleRepo }),
        inject: [RULE_REPOSITORY_TOKEN],
    },
    {
        provide: PromoteRuleToGlobalUseCase,
        useFactory: (ruleRepo: IRuleRepository) =>
            new PromoteRuleToGlobalUseCase({ ruleRepo, newId: randomId, now: nowIso }),
        inject: [RULE_REPOSITORY_TOKEN],
    },
    {
        provide: ClassifyTerminalLaneUseCase,
        useFactory: (ruleRepo: IRuleRepository) =>
            new ClassifyTerminalLaneUseCase(ruleRepo),
        inject: [RULE_REPOSITORY_TOKEN],
    },
];

export const RULES_APPLICATION_EXPORTS = [
    CreateRuleUseCase,
    DeleteRuleUseCase,
    ListRulesUseCase,
    RegisterSuggestionUseCase,
    UpdateRuleUseCase,
    PromoteRuleToGlobalUseCase,
    ClassifyTerminalLaneUseCase,
] as const;
