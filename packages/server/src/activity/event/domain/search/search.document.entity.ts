import { Column, Entity, Index, PrimaryColumn } from "typeorm";

/**
 * Search index document — denormalized text for substring/lexical search and
 * an optional embedding (JSON-encoded vector) for semantic ranking.
 * `(scope, entity_id)` is the natural key — same row replaced on each refresh.
 */
@Entity({ name: "search_documents" })
@Index("idx_search_documents_scope_task_updated", ["scope", "taskId", "updatedAt"])
export class SearchDocumentEntity {
    @PrimaryColumn({ type: "text" })
    scope!: "task" | "event";

    @PrimaryColumn({ name: "entity_id", type: "text" })
    entityId!: string;

    @Column({ name: "task_id", type: "text", nullable: true })
    taskId!: string | null;

    @Column({ name: "search_text", type: "text" })
    searchText!: string;

    @Column({ type: "text", nullable: true })
    embedding!: string | null;

    @Column({ name: "embedding_model", type: "text", nullable: true })
    embeddingModel!: string | null;

    @Column({ name: "updated_at", type: "text" })
    updatedAt!: string;
}
