import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type TaskRelationKind = "parent" | "background" | "spawned_by_session";

@Entity({ name: "task_relations" })
@Index("idx_task_relations_related", ["relatedTaskId", "relationKind"])
export class TaskRelationEntity {
    @PrimaryColumn({ name: "task_id", type: "text" })
    taskId!: string;

    @PrimaryColumn({ name: "relation_kind", type: "text" })
    relationKind!: TaskRelationKind;

    @Column({ name: "related_task_id", type: "text", nullable: true })
    relatedTaskId!: string | null;

    @Column({ name: "session_id", type: "text", nullable: true })
    sessionId!: string | null;
}
