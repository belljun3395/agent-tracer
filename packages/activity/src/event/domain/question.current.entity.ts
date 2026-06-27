import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "questions_current" })
@Index("idx_questions_task_phase", ["taskId", "phase"])
export class QuestionCurrentEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ type: "text" })
    title!: string;

    @Column({ type: "text" })
    phase!: string;

    @Column({ type: "integer", nullable: true })
    sequence!: number | null;

    @Column({ name: "model_name", type: "text", nullable: true })
    modelName!: string | null;

    @Column({ name: "model_provider", type: "text", nullable: true })
    modelProvider!: string | null;

    @Column({ name: "last_event_id", type: "text", nullable: true })
    lastEventId!: string | null;

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;

    @Column({ name: "updated_at", type: "text" })
    updatedAt!: string;
}
