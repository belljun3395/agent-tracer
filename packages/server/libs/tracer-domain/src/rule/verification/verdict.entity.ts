import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import {
    VERDICT_STATUS,
    concludeAtTaskEnd,
    isEscalated,
    isTerminalVerdict,
    type RuleSeverity,
    type VerdictEvidence,
    type VerdictStatus,
} from "@monitor/kernel";

@Entity({ name: "verdicts" })
@Index("verdicts_turn", ["turnId"])
export class VerdictEntity {
    /** 규칙 하나에 판정 하나이므로 규칙이 곧 판정의 식별자다. */
    @PrimaryColumn({ name: "rule_id", type: "text" })
    ruleId!: string;

    /** 이 판정을 마지막으로 전진시킨 턴이다. */
    @Column({ name: "turn_id", type: "text" })
    turnId!: string;

    @Column({ type: "text" })
    status!: VerdictStatus;

    /** 집계가 규칙 표를 다시 읽지 않도록 판정 시점의 심각도를 함께 남긴다. */
    @Column({ type: "text" })
    severity!: RuleSeverity;

    /** 에이전트에게 미이행을 알린 횟수이며 상한을 넘기면 그만 막는다. */
    @Column({ name: "nudge_count", type: "integer", default: 0 })
    nudgeCount!: number;

    @Column({ type: "jsonb", default: {} })
    evidence!: VerdictEvidence;

    @Column({ name: "evaluated_at", type: "timestamptz" })
    evaluatedAt!: Date;

    /** 이 판정을 마지막으로 전진시킨 창의 최대 이벤트 seq다. */
    @Column({ name: "last_evaluated_seq", type: "text", nullable: true })
    lastEvaluatedSeq!: string | null;

    isOpen(): boolean {
        return !isTerminalVerdict(this.status);
    }

    /** lastEvaluatedSeq가 주어진 seq를 이미 포함하는지 판정한다. */
    hasSeenThrough(maxSeq: string): boolean {
        return this.lastEvaluatedSeq !== null && BigInt(this.lastEvaluatedSeq) >= BigInt(maxSeq);
    }

    markEvaluatedSeq(maxSeq: string): void {
        this.lastEvaluatedSeq = maxSeq;
    }

    isEscalated(): boolean {
        return isEscalated(this.status, this.nudgeCount);
    }

    advance(turnId: string, status: VerdictStatus, evidence: VerdictEvidence, at: Date): void {
        if (isTerminalVerdict(this.status)) return;
        this.turnId = turnId;
        this.status = status;
        this.evidence = evidence;
        this.evaluatedAt = at;
    }

    recordNudge(at: Date): void {
        this.nudgeCount += 1;
        this.evaluatedAt = at;
    }

    concludeTask(at: Date): void {
        const next = concludeAtTaskEnd(this.status);
        if (next === this.status) return;
        this.status = next;
        this.evaluatedAt = at;
    }

    static open(
        ruleId: string,
        turnId: string,
        severity: RuleSeverity,
        evidence: VerdictEvidence,
        at: Date,
    ): VerdictEntity {
        const verdict = new VerdictEntity();
        verdict.ruleId = ruleId;
        verdict.turnId = turnId;
        verdict.status = VERDICT_STATUS.open;
        verdict.severity = severity;
        verdict.nudgeCount = 0;
        verdict.evidence = evidence;
        verdict.evaluatedAt = at;
        verdict.lastEvaluatedSeq = null;
        return verdict;
    }
}
