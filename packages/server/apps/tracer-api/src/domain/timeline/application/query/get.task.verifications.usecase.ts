import { Inject, Injectable } from "@nestjs/common";
import { VERDICT_STATUS } from "@monitor/kernel";
import { RULE_REPOSITORY, type RuleRepositoryPort } from "~tracer-api/domain/timeline/port/rule.repository.port.js";
import { RULE_TASK_READER, type TaskReaderPort } from "~tracer-api/domain/timeline/port/rule.task.reader.port.js";
import { RULE_TURN_REPOSITORY, type TurnRepositoryPort } from "~tracer-api/domain/timeline/port/turn.repository.port.js";
import { RULE_VERDICT_REPOSITORY, type VerdictRepositoryPort } from "~tracer-api/domain/timeline/port/verdict.repository.port.js";

export interface TaskVerificationDto {
    readonly id: string;
    readonly taskId: string;
    readonly ruleId: string;
    readonly ruleName: string;
    readonly turnId: string;
    readonly evaluatedAt: string;
    readonly triggerEventId?: string;
    readonly matchedEventIds: readonly string[];
}

/** 그래프 VERI 레인이 쓰는 턴별 verified 판정과 그 증거를 제공한다. */
@Injectable()
export class GetTaskVerificationsUseCase {
    constructor(
        @Inject(RULE_TASK_READER)
        private readonly tasks: TaskReaderPort,
        @Inject(RULE_TURN_REPOSITORY)
        private readonly turns: TurnRepositoryPort,
        @Inject(RULE_VERDICT_REPOSITORY)
        private readonly verdicts: VerdictRepositoryPort,
        @Inject(RULE_REPOSITORY)
        private readonly rules: RuleRepositoryPort,
    ) {}

    async execute(userId: string, taskId: string): Promise<readonly TaskVerificationDto[] | null> {
        const task = await this.tasks.findById(taskId);
        if (task === null || !task.isOwnedBy(userId)) return null;

        const turns = await this.turns.findByTask(taskId);
        const verdicts = await this.verdicts.findByTurns(turns.map((turn) => turn.id));
        const verified = verdicts.filter((verdict) => verdict.status === VERDICT_STATUS.satisfied);
        if (verified.length === 0) return [];

        const rules = await this.rules.findApplicable(userId, taskId);
        const ruleNameById = new Map(rules.map((rule) => [rule.id, rule.name] as const));

        return verified.map((verdict) => {
            const trigger = verdict.evidence.enforcements.find((e) => e.matchKind === "trigger");
            const matched = verdict.evidence.enforcements.filter((e) => e.matchKind === "expect-fulfilled");
            return {
                id: `${verdict.turnId}:${verdict.ruleId}`,
                taskId,
                ruleId: verdict.ruleId,
                ruleName: ruleNameById.get(verdict.ruleId) ?? verdict.ruleId,
                turnId: verdict.turnId,
                evaluatedAt: verdict.evaluatedAt.toISOString(),
                ...(trigger !== undefined ? { triggerEventId: trigger.eventId } : {}),
                matchedEventIds: matched.map((m) => m.eventId),
            };
        });
    }
}
