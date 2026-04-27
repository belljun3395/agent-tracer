// TODO(session-typeorm-migration): delete this file once drizzle is removed.
// SessionEntity (TypeORM, src/session/domain/session.entity.ts) is the source
// of truth for the sessions_current table. This drizzle table definition is
// kept ONLY because other modules' drizzle relations (timeline-events, tasks,
// verification, runtime-bindings) still reference it for FK declarations.
// When those modules are migrated to TypeORM, drop this file along with
// drizzle.schema.ts entries.

import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessionsCurrent = sqliteTable("sessions_current", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  status: text("status").notNull(),
  summary: text("summary"),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
}, (table) => [
  index("idx_sessions_current_task_started").on(table.taskId, table.startedAt),
  index("idx_sessions_current_task_status_started").on(table.taskId, table.status, table.startedAt),
]);
