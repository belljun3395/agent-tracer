import type { Rule } from "~domain/verification/index.js";
import { aggregateVerdict } from "~domain/verification/index.js";
import type { ITurnRepository } from "~application/ports/repository/turn.repository.js";
import type { IVerdictRepository } from "~application/ports/repository/verdict.repository.js";
import type { BackfillTurnRow, ITurnQueryRepository } from "~application/ports/repository/turn.query.repository.js";
import { evaluateTurn } from "./evaluate.turn.js";
import { persistVerdicts } from "./persist.verdicts.js";

/** Subset of {@link ITurnQueryRepository} that backfill needs. */
export type BackfillTurnSource = Pick<ITurnQueryRepository, "listTurnsForBackfill">;
export type { BackfillTurnRow };

export interface BackfillResult {
    readonly turnsConsidered: number;
    readonly turnsEvaluated: number;
    readonly verdictsCreated: number;
}

export interface BackfillRuleEvaluationDeps {
    readonly turnRepo: ITurnRepository;
    readonly turnSource: BackfillTurnSource;
    readonly verdictRepo: IVerdictRepository;
    readonly now: () => string;
    readonly newVerdictId: () => string;
}

/**
 * Re-evaluates a newly active rule against existing turns within its scope.
 *
 * For each candidate turn:
 *   1. Skip if a verdict already exists for (turn, rule) — idempotent re-runs.
 *   2. Run the pure evaluator with rules=[rule].
 *   3. Insert any emitted verdict, bump rules_evaluated_count by 1, and
 *      recompute aggregate_verdict from the full verdict set.
 *
 * Step 1's idempotency lets the caller invoke backfill multiple times
 * (e.g. on every approve) without double-counting. Step 3 reads all
 * verdicts after insert, so the aggregate stays correct even if the new
 * rule is one of many already evaluated against this turn.
 */
export class BackfillRuleEvaluationUseCase {
    constructor(private readonly deps: BackfillRuleEvaluationDeps) {}

    async execute(rule: Rule): Promise<BackfillResult> {
        const { turnRepo, turnSource, verdictRepo, now, newVerdictId } = this.deps;
        const scope = rule.scope === "task" && rule.taskId
            ? { scope: "task" as const, taskId: rule.taskId }
            : { scope: "global" as const };

        const turns = await turnSource.listTurnsForBackfill(scope);
        let evaluated = 0;
        let created = 0;

        for (const turn of turns) {
            if (await verdictRepo.existsByTurnIdAndRuleId(turn.id, rule.id)) continue;

            const { verdicts } = evaluateTurn({
                turnId: turn.id,
                assistantText: turn.assistantText,
                ...(turn.userMessageText ? { userMessageText: turn.userMessageText } : {}),
                toolCalls: turn.toolCalls,
                rules: [rule],
                now: now(),
                newVerdictId,
            });

            const persisted = await persistVerdicts(verdictRepo, verdicts, now());
            created += persisted.length;

            await turnRepo.updateRulesEvaluatedCount(turn.id, turn.rulesEvaluatedCount + 1);

            if (persisted.length > 0) {
                const allVerdicts = await verdictRepo.findByTurnId(turn.id);
                const aggregate = aggregateVerdict(allVerdicts.map((v) => v.status));
                await turnRepo.updateAggregateVerdict(turn.id, aggregate);
            }

            evaluated += 1;
        }

        return {
            turnsConsidered: turns.length,
            turnsEvaluated: evaluated,
            verdictsCreated: created,
        };
    }
}
