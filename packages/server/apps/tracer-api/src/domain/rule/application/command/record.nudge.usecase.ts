import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { isEscalated } from "@monitor/kernel";
import { CLOCK, type ClockPort } from "~tracer-api/domain/rule/port/clock.port.js";
import { RULE_REPOSITORY, type RuleRepositoryPort } from "~tracer-api/domain/rule/port/rule.repository.port.js";
import {
    RULE_VERDICT_REPOSITORY,
    type VerdictRepositoryPort,
} from "~tracer-api/domain/rule/port/verdict.repository.port.js";

export interface NudgeResult {
    readonly nudgeCount: number;
    readonly escalated: boolean;
}

/** 로컬이 에이전트에게 미이행을 알렸음을 판정에 기록해 상한이 데몬 재기동을 넘어 살아남게 한다. */
@Injectable()
export class RecordNudgeUseCase {
    constructor(
        @Inject(RULE_REPOSITORY)
        private readonly rules: RuleRepositoryPort,
        @Inject(RULE_VERDICT_REPOSITORY)
        private readonly verdicts: VerdictRepositoryPort,
        @Inject(CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(userId: string, ruleId: string): Promise<NudgeResult> {
        const rule = await this.rules.findById(ruleId);
        // 남의 규칙은 존재 여부도 드러내지 않는다.
        if (rule === null || rule.userId !== userId) throw new NotFoundException("Rule not found");

        const verdict = await this.verdicts.findByRule(ruleId);
        if (verdict === null || !verdict.isOpen()) {
            return { nudgeCount: verdict?.nudgeCount ?? 0, escalated: false };
        }

        verdict.recordNudge(this.clock.now());
        await this.verdicts.upsert(verdict);
        return {
            nudgeCount: verdict.nudgeCount,
            escalated: isEscalated(verdict.status, verdict.nudgeCount),
        };
    }
}
