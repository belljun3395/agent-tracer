import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "timeline_events_view" })
@Index("idx_timeline_events_view_task_created", ["taskId", "createdAt"])
@Index("idx_timeline_events_subtype_group", ["subtypeGroup", "createdAt"])
@Index("idx_timeline_events_tool_family", ["toolFamily"])
@Index("idx_timeline_events_lane_created", ["lane", "createdAt"])
export class TimelineEventEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

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

    @Column({ name: "extras_json", type: "text", default: "{}" })
    extrasJson!: string;

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;
}
