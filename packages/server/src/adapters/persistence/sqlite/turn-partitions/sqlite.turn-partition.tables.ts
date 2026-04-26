import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { tasksCurrent } from "../tasks/sqlite.task.tables.js";

export const turnPartitions = sqliteTable("turn_partitions_current", {
  taskId: text("task_id").primaryKey().references(() => tasksCurrent.id, { onDelete: "cascade" }),
  groupsJson: text("groups_json").notNull(),
  version: integer("version").notNull(),
  updatedAt: text("updated_at").notNull(),
});
