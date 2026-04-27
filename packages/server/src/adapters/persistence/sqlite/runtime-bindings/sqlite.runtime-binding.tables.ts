// TODO(session-typeorm-migration): delete this file once drizzle is removed.
// RuntimeBindingEntity (TypeORM, src/session/domain/runtime.binding.entity.ts)
// is the source of truth for the runtime_bindings_current table. This drizzle
// definition is kept only because tasks's drizzle relations still need a FK
// reference target. Drop together with sqlite.session.tables.ts when the
// remaining modules migrate to TypeORM.

import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sessionsCurrent } from "../sessions/sqlite.session.tables.js";
import { tasksCurrent } from "../tasks/sqlite.task.tables.js";

export const runtimeSessionBindings = sqliteTable("runtime_bindings_current", {
  runtimeSource: text("runtime_source").notNull(),
  runtimeSessionId: text("runtime_session_id").notNull(),
  taskId: text("task_id").notNull().references(() => tasksCurrent.id, { onDelete: "cascade" }),
  monitorSessionId: text("monitor_session_id").references(() => sessionsCurrent.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.runtimeSource, table.runtimeSessionId] }),
]);
