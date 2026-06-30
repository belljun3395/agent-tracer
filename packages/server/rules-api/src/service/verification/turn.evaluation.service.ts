import type { TurnVerdict } from "@monitor/rules-api/domain/verification/type/verdict.type.js";
import { evaluateTurn } from "@monitor/rules-api/domain/verification/turn.evaluation.policy.js";
import { aggregateVerdict } from "@monitor/rules-api/domain/verification/verdict.policy.js";
import type { IRuleAccess } from "@monitor/rules-api/application/verification/outbound/rule.access.port.js";
import type { ITurnRepository } from "@monitor/rules-api/application/verification/outbound/turn.repository.port.js";
import type { IVerdictRepository } from "@monitor/rules-api/application/verification/outbound/verdict.repository.port.js";

export interface TurnEvaluationToolCall {
    readonly tool: string;
    readonly command?: string;
    readonly filePath?: string;
}

export interface TurnEvaluationInput {
    readonly turnId: string;
    readonly taskId: string;
    readonly assistantText: string;
    readonly userMessageText?: string;
    readonly toolCalls: ReadonlyArray<TurnEvaluationToolCall>;
}

export interface TurnEvaluationResult {
    readonly rulesEvaluated: number;
    readonly evaluatedRuleIds: readonly string[];
    readonly verdictCount: number;
}

export class TurnEvaluationService {
    constructor(
        private readonly ruleRepo: IRuleAccess,
        private readonly turnRepo: ITurnRepository,
        private readonly verdictRepo: IVerdictRepository,
        private readonly now: () => string = () => new Date().toISOString(),
    ) {}

    async evaluate(input: TurnEvaluationInput): Promise<TurnEvaluationResult> {
        const rules = await this.ruleRepo.findActiveForTurn(input.taskId);
        if (rules.length === 0) {
            return { rulesEvaluated: 0, evaluatedRuleIds: [], verdictCount: 0 };
        }

        const result = evaluateTurn({
            turnId: input.turnId,
            assistantText: input.assistantText,
            ...(input.userMessageText !== undefined ? { userMessageText: input.userMessageText } : {}),
            toolCalls: input.toolCalls,
            rules,
            now: this.now(),
        });

        await this.persistVerdicts(result.verdicts, this.now());
        await this.turnRepo.updateRulesEvaluatedCount(input.turnId, rules.length);

        const allVerdicts = await this.verdictRepo.findByTurnId(input.turnId);
        const aggregate = aggregateVerdict(allVerdicts.map((v) => v.status));
        await this.turnRepo.updateAggregateVerdict(input.turnId, aggregate);

        return {
            rulesEvaluated: rules.length,
            evaluatedRuleIds: rules.map((rule) => rule.id),
            verdictCount: result.verdicts.length,
        };
    }

    private async persistVerdicts(
        verdicts: ReadonlyArray<TurnVerdict>,
        evaluatedAt: string,
    ): Promise<TurnVerdict[]> {
        const persisted: TurnVerdict[] = [];
        for (const verdict of verdicts) {
            const saved = await this.verdictRepo.insert({
                turnId: verdict.turnId,
                ruleId: verdict.ruleId,
                status: verdict.status,
                detail: {
                    ...(verdict.detail.matchedPhrase !== undefined
                        ? { matchedPhrase: verdict.detail.matchedPhrase }
                        : {}),
                    ...(verdict.detail.expectedPattern !== undefined
                        ? { expectedPattern: verdict.detail.expectedPattern }
                        : {}),
                    actualToolCalls: [...verdict.detail.actualToolCalls],
                    ...(verdict.detail.matchedToolCalls !== undefined
                        ? { matchedToolCalls: [...verdict.detail.matchedToolCalls] }
                        : {}),
                },
                evaluatedAt,
            });
            persisted.push(saved);
        }
        return persisted;
    }
}
