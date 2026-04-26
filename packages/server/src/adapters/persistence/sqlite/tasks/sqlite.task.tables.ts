import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tasksCurrent = sqliteTable("tasks_current", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  workspacePath: text("workspace_path"),
  status: text("status").notNull(),
  taskKind: text("task_kind").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  lastSessionStartedAt: text("last_session_started_at"),
  cliSource: text("cli_source"),
}, (table) => [
  index("idx_tasks_current_updated").on(table.updatedAt),
]);

export const taskRelations = sqliteTable("task_relations", {
  taskId: text("task_id").notNull().references(() => tasksCurrent.id, { onDelete: "cascade" }),
  relatedTaskId: text("related_task_id").references(() => tasksCurrent.id, { onDelete: "cascade" }),
  relationKind: text("relation_kind").notNull(),
  sessionId: text("session_id"),
}, (table) => [
  index("idx_task_relations_related").on(table.relatedTaskId, table.relationKind),
]);
