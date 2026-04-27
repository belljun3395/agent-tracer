import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type TaskRelationKind = "parent" | "background" | "spawned_by_session";

/**
 * task_relations table: parent / background / spawned_by_session links between tasks.
 * Composite "primary key" is logical (task_id + relation_kind + related_task_id|session_id);
 * we declare two PrimaryColumns to satisfy TypeORM, with the actual uniqueness enforced
 * by the partial indexes set up in the SQLite schema.
 */
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
