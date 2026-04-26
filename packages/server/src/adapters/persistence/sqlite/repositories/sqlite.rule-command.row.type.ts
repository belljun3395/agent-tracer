import type { InferSelectModel } from "drizzle-orm";
import type { RuleCommandRecord } from "~application/ports/repository/rule-command.repository.js";
import type { ruleCommands } from "../schema/drizzle.schema.js";

export type RuleCommandRow = InferSelectModel<typeof ruleCommands>;

export function mapRuleCommandRow(row: RuleCommandRow): RuleCommandRecord {
  return {
    id: row.id,
    pattern: row.pattern,
    label: row.label,
    createdAt: row.createdAt,
    ...(row.taskId ? { taskId: row.taskId } : {}),
  };
}
