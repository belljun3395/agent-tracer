import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sessionsCurrent } from "../sessions/sqlite.session.tables.js";
import { tasksCurrent } from "../tasks/sqlite.task.tables.js";
import { timelineEvents } from "../timeline-events/sqlite.timeline-event.tables.js";

export const rules = sqliteTable("rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  triggerPhrasesJson: text("trigger_phrases_json"),
  triggerOn: text("trigger_on"),
  expectTool: text("expect_tool"),
  expectCommandMatchesJson: text("expect_command_matches_json"),
  expectPattern: text("expect_pattern"),
  scope: text("scope").notNull(),
  taskId: text("task_id").references(() => tasksCurrent.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  severity: text("severity").notNull(),
  rationale: text("rationale"),
  signature: text("signature").notNull(),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
}, (table) => [
  index("idx_rules_signature").on(table.signature),
]);

export const turns = sqliteTable("turns", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessionsCurrent.id, { onDelete: "cascade" }),
  taskId: text("task_id").notNull().references(() => tasksCurrent.id, { onDelete: "cascade" }),
  turnIndex: integer("turn_index").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  askedText: text("asked_text"),
  assistantText: text("assistant_text"),
  aggregateVerdict: text("aggregate_verdict"),
  rulesEvaluatedCount: integer("rules_evaluated_count").notNull(),
}, (table) => [
  index("idx_turns_task_started").on(table.taskId, table.startedAt),
]);

export const turnEvents = sqliteTable("turn_events", {
  turnId: text("turn_id").notNull().references(() => turns.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull().references(() => timelineEvents.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.turnId, table.eventId] }),
  index("idx_turn_events_event").on(table.eventId),
]);

export const verdicts = sqliteTable("verdicts", {
  turnId: text("turn_id").notNull().references(() => turns.id, { onDelete: "cascade" }),
  ruleId: text("rule_id").notNull().references(() => rules.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  matchedPhrase: text("matched_phrase"),
  expectedPattern: text("expected_pattern"),
  actualToolCallsJson: text("actual_tool_calls_json"),
  matchedToolCallsJson: text("matched_tool_calls_json"),
  evaluatedAt: text("evaluated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.turnId, table.ruleId] }),
  index("idx_verdicts_rule").on(table.ruleId),
  index("idx_verdicts_status").on(table.status),
]);

export const ruleEnforcements = sqliteTable("rule_enforcements", {
  eventId: text("event_id").notNull().references(() => timelineEvents.id, { onDelete: "cascade" }),
  ruleId: text("rule_id").notNull().references(() => rules.id, { onDelete: "cascade" }),
  matchKind: text("match_kind").notNull(),
  decidedAt: text("decided_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.eventId, table.ruleId, table.matchKind] }),
  index("idx_rule_enforcements_rule").on(table.ruleId),
]);
