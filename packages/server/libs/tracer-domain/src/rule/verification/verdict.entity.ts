import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { VERDICT_STATUS, type VerdictEvidence, type VerdictStatus } from "@monitor/kernel";

@Entity({ name: "verdicts" })
@Index("verdicts_rule", ["ruleId"])
export class VerdictEntity {
    @PrimaryColumn({ name: "turn_id", type: "text" })
    turnId!: string;

    @PrimaryColumn({ name: "rule_id", type: "text" })
    ruleId!: string;

    @Column({ type: "text" })
    status!: VerdictStatus;

    @Column({ type: "jsonb", default: {} })
    evidence!: VerdictEvidence;

    @Column({ name: "evaluated_at", type: "timestamptz" })
    evaluatedAt!: Date;

    isContradicted(): boolean {
        return this.status === VERDICT_STATUS.contradicted;
    }

    static record(
        turnId: string,
        ruleId: string,
        status: VerdictStatus,
        evidence: VerdictEvidence,
        at: Date,
    ): VerdictEntity {
        const verdict = new VerdictEntity();
        verdict.turnId = turnId;
        verdict.ruleId = ruleId;
        verdict.status = status;
        verdict.evidence = evidence;
        verdict.evaluatedAt = at;
        return verdict;
    }
}
