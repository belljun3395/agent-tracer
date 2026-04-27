import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "rule_enforcements" })
@Index("idx_rule_enforcements_rule", ["ruleId"])
@Index("idx_rule_enforcements_event", ["eventId"])
export class RuleEnforcementEntity {
    @PrimaryColumn({ name: "event_id", type: "text" })
    eventId!: string;

    @PrimaryColumn({ name: "rule_id", type: "text" })
    ruleId!: string;

    @PrimaryColumn({ name: "match_kind", type: "text" })
    matchKind!: "trigger" | "expect-fulfilled";

    @Column({ name: "decided_at", type: "text" })
    decidedAt!: string;
}
