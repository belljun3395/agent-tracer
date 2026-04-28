import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "rules" })
@Index("idx_rules_scope_active", ["scope"])
@Index("idx_rules_task_active", ["taskId"])
@Index("idx_rules_signature", ["signature"])
export class RuleEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ type: "text" })
    name!: string;

    @Column({ name: "trigger_phrases_json", type: "text", nullable: true })
    triggerPhrasesJson!: string | null;

    @Column({ name: "trigger_on", type: "text", nullable: true })
    triggerOn!: "user" | "assistant" | null;

    @Column({ name: "expect_tool", type: "text", nullable: true })
    expectTool!: string | null;

    @Column({ name: "expect_command_matches_json", type: "text", nullable: true })
    expectCommandMatchesJson!: string | null;

    @Column({ name: "expect_pattern", type: "text", nullable: true })
    expectPattern!: string | null;

    @Column({ type: "text" })
    scope!: "global" | "task";

    @Column({ name: "task_id", type: "text", nullable: true })
    taskId!: string | null;

    @Column({ type: "text" })
    source!: "human" | "agent";

    @Column({ type: "text" })
    severity!: "info" | "warn" | "block";

    @Column({ type: "text", nullable: true })
    rationale!: string | null;

    @Column({ type: "text" })
    signature!: string;

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;

    @Column({ name: "deleted_at", type: "text", nullable: true })
    deletedAt!: string | null;
}
