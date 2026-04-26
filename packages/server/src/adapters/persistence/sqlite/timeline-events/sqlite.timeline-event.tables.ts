import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sessionsCurrent } from "../sessions/sqlite.session.tables.js";
import { tasksCurrent } from "../tasks/sqlite.task.tables.js";

export const timelineEvents = sqliteTable("timeline_events_view", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasksCurrent.id, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => sessionsCurrent.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  lane: text("lane").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  subtypeKey: text("subtype_key"),
  subtypeLabel: text("subtype_label"),
  subtypeGroup: text("subtype_group"),
  toolFamily: text("tool_family"),
  operation: text("operation"),
  sourceTool: text("source_tool"),
  toolName: text("tool_name"),
  entityType: text("entity_type"),
  entityName: text("entity_name"),
  displayTitle: text("display_title"),
  evidenceLevel: text("evidence_level"),
  metadataJson: text("extras_json").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_timeline_events_view_task_created").on(table.taskId, table.createdAt),
  index("idx_timeline_events_subtype_group").on(table.subtypeGroup, table.createdAt),
  index("idx_timeline_events_tool_family").on(table.toolFamily),
  index("idx_timeline_events_lane_created").on(table.lane, table.createdAt),
]);
