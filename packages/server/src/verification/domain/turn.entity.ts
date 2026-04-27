import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "turns" })
@Index("idx_turns_session_index", ["sessionId", "turnIndex"], { unique: true })
@Index("idx_turns_task_started", ["taskId", "startedAt"])
@Index("idx_turns_session_open", ["sessionId"])
export class TurnEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "session_id", type: "text" })
    sessionId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "turn_index", type: "integer" })
    turnIndex!: number;

    @Column({ type: "text" })
    status!: "open" | "closed";

    @Column({ name: "started_at", type: "text" })
    startedAt!: string;

    @Column({ name: "ended_at", type: "text", nullable: true })
    endedAt!: string | null;

    @Column({ name: "asked_text", type: "text", nullable: true })
    askedText!: string | null;

    @Column({ name: "assistant_text", type: "text", nullable: true })
    assistantText!: string | null;

    @Column({ name: "aggregate_verdict", type: "text", nullable: true })
    aggregateVerdict!: "verified" | "contradicted" | "unverifiable" | null;

    @Column({ name: "rules_evaluated_count", type: "integer", default: 0 })
    rulesEvaluatedCount!: number;
}
