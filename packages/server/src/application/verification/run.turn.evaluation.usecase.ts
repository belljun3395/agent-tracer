import type { IRuleRepository } from "../ports/repository/rule.repository.js";
import type { IVerdictRepository } from "../ports/repository/verdict.repository.js";
import type { Rule, TurnVerdict } from "~domain/verification/index.js";
import { evaluateTurn, type EvaluateTurnToolCall } from "./evaluate.turn.js";
import type { NotifierService } from "~application/notifications/index.js";
import { persistVerdicts } from "./persist.verdicts.js";

export interface RunTurnEvaluationInput {
    readonly turnId: string;
    readonly taskId: string;
    readonly turnIndex?: number;
    readonly assistantText: string;
    readonly userMessageText?: string;
    readonly toolCalls: ReadonlyArray<EvaluateTurnToolCall>;
}

export interface RunTurnEvaluationOutput {
    readonly verdicts: ReadonlyArray<TurnVerdict>;
    readonly rulesEvaluated: number;
    readonly evaluatedRules: ReadonlyArray<Rule>;
}

export interface RunTurnEvaluationDeps {
    readonly ruleRepo: IRuleRepository;
    readonly verdictRepo: IVerdictRepository;
    readonly now: () => string;
    readonly newVerdictId: () => string;
    readonly notifier?: NotifierService;
}

/**
 * Orchestrator for a single-turn verification pass.
 *
 * Reads active rules from the rule repository (filtered to `scope=global`
 * + matching task), runs the pure {@link evaluateTurn} function, persists
 * each emitted verdict via the verdict repository, and returns the
 * persisted verdicts plus how many active rules were considered.
 *
 * `rulesEvaluated` distinguishes "no rules registered" (= 0) from "rules
 * registered but none of their triggers matched this turn" (> 0 with empty
 * verdicts). Without it the dashboard cannot tell the two cases apart.
 *
 * Short-circuits when there are no active rules — in that case the
 * verdict repository is not touched and the count is 0.
 */
export class RunTurnEvaluationUseCase {
    constructor(private readonly deps: RunTurnEvaluationDeps) {}

    async execute(
        input: RunTurnEvaluationInput,
    ): Promise<RunTurnEvaluationOutput> {
        const { ruleRepo, verdictRepo, now, newVerdictId } = this.deps;

        const rules = await ruleRepo.findActiveForTurn(input.taskId);
        const rulesEvaluated = rules.length;
        if (rulesEvaluated === 0) {
            return { verdicts: [], rulesEvaluated: 0, evaluatedRules: [] };
        }

        const { verdicts } = evaluateTurn({
            turnId: input.turnId,
            assistantText: input.assistantText,
            ...(input.userMessageText !== undefined ? { userMessageText: input.userMessageText } : {}),
            toolCalls: input.toolCalls,
            rules,
            now: now(),
            newVerdictId,
        });

        if (verdicts.length === 0) {
            return { verdicts: [], rulesEvaluated, evaluatedRules: rules };
        }

        const persisted = await persistVerdicts(verdictRepo, verdicts, now());

        await this.deps.notifier?.handleNewVerdicts({
            turnId: input.turnId,
            turnIndex: input.turnIndex ?? 0,
            verdicts: persisted,
        });

        return { verdicts: persisted, rulesEvaluated, evaluatedRules: rules };
    }
}
