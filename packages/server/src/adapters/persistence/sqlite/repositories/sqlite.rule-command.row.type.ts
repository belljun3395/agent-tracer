import type { RuleCommandRecord } from "~application/ports/repository/rule-command.repository.js";

export interface RuleCommandRow {
  id: string;
  pattern: string;
  label: string;
  taskId: string | null;
  createdAt: string;
}

export function mapRuleCommandRow(row: RuleCommandRow): RuleCommandRecord {
  return {
    id: row.id,
    pattern: row.pattern,
    label: row.label,
    createdAt: row.createdAt,
    ...(row.taskId ? { taskId: row.taskId } : {}),
  };
}
