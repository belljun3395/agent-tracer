import { Column, Entity, Generated, Index, PrimaryColumn } from "typeorm";
import { z } from "zod";
import { zodJsonbTransformer } from "./jsonb.column.js";

const metadataSchema = z.record(z.string(), z.unknown());
const tagsSchema = z.array(z.string());

@Entity({ name: "timeline_events" })
@Index("idx_timeline_events_user_created", ["userId", "createdAt"])
@Index("idx_timeline_events_task_created", ["taskId", "createdAt"])
@Index("idx_timeline_events_subtype_group", ["subtypeGroup", "createdAt"])
@Index("idx_timeline_events_tool_family", ["toolFamily"])
@Index("idx_timeline_events_lane_created", ["lane", "createdAt"])
@Index("idx_timeline_events_task_seq", ["taskId", "seq"])
export class TimelineEventEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    // 서버 할당 단조 시퀀스. 인과 순서의 기준이며 클라 벽시계(createdAt)는 표시용.
    @Column({ name: "seq", type: "bigint" })
    @Generated("increment")
    seq!: string;

    @Column({ name: "user_id", type: "text", default: "local" })
    userId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "session_id", type: "text", nullable: true })
    sessionId!: string | null;

    @Column({ type: "text" })
    kind!: string;

    @Column({ type: "text" })
    lane!: string;

    @Column({ type: "text" })
    title!: string;

    @Column({ type: "text", nullable: true })
    body!: string | null;

    @Column({ name: "subtype_key", type: "text", nullable: true })
    subtypeKey!: string | null;

    @Column({ name: "subtype_label", type: "text", nullable: true })
    subtypeLabel!: string | null;

    @Column({ name: "subtype_group", type: "text", nullable: true })
    subtypeGroup!: string | null;

    @Column({ name: "tool_family", type: "text", nullable: true })
    toolFamily!: string | null;

    @Column({ type: "text", nullable: true })
    operation!: string | null;

    @Column({ name: "source_tool", type: "text", nullable: true })
    sourceTool!: string | null;

    @Column({ name: "tool_name", type: "text", nullable: true })
    toolName!: string | null;

    @Column({ name: "entity_type", type: "text", nullable: true })
    entityType!: string | null;

    @Column({ name: "entity_name", type: "text", nullable: true })
    entityName!: string | null;

    @Column({ name: "display_title", type: "text", nullable: true })
    displayTitle!: string | null;

    @Column({ name: "evidence_level", type: "text", nullable: true })
    evidenceLevel!: string | null;

    @Column({ type: "jsonb", default: {}, transformer: zodJsonbTransformer(metadataSchema) })
    metadata!: Record<string, unknown>;

    @Column({ type: "jsonb", default: [], transformer: zodJsonbTransformer(tagsSchema) })
    tags!: string[];

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;

    extrasJson?: string;
}
