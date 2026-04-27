import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "verdicts" })
@Index("idx_verdicts_rule", ["ruleId"])
@Index("idx_verdicts_status", ["status"])
export class VerdictEntity {
    @PrimaryColumn({ name: "turn_id", type: "text" })
    turnId!: string;

    @PrimaryColumn({ name: "rule_id", type: "text" })
    ruleId!: string;

    @Column({ type: "text" })
    status!: "verified" | "contradicted" | "unverifiable";

    @Column({ name: "matched_phrase", type: "text", nullable: true })
    matchedPhrase!: string | null;

    @Column({ name: "expected_pattern", type: "text", nullable: true })
    expectedPattern!: string | null;

    @Column({ name: "actual_tool_calls_json", type: "text", nullable: true })
    actualToolCallsJson!: string | null;

    @Column({ name: "matched_tool_calls_json", type: "text", nullable: true })
    matchedToolCallsJson!: string | null;

    @Column({ name: "evaluated_at", type: "text" })
    evaluatedAt!: string;
}
