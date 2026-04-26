import { relations } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const searchDocuments = sqliteTable("search_documents", {
  scope: text("scope").notNull(),
  entityId: text("entity_id").notNull(),
  taskId: text("task_id"),
  searchText: text("search_text").notNull(),
  embedding: text("embedding"),
  embeddingModel: text("embedding_model"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.scope, table.entityId] }),
  index("idx_search_documents_scope_task_updated").on(table.scope, table.taskId, table.updatedAt),
]);

export const turnPartitions = sqliteTable("turn_partitions_current", {
  taskId: text("task_id").primaryKey().references(() => tasksCurrent.id, { onDelete: "cascade" }),
  groupsJson: text("groups_json").notNull(),
  version: integer("version").notNull(),
  updatedAt: text("updated_at").notNull(),
});

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

export const tasksCurrentRelations = relations(tasksCurrent, ({ many }) => ({
  sessions: many(sessionsCurrent),
  events: many(timelineEvents),
  runtimeBindings: many(runtimeSessionBindings),
  ownedRelations: many(taskRelations, { relationName: "taskRelationOwner" }),
  relatedRelations: many(taskRelations, { relationName: "taskRelationRelated" }),
}));

export const taskRelationsRelations = relations(taskRelations, ({ one }) => ({
  task: one(tasksCurrent, {
    fields: [taskRelations.taskId],
    references: [tasksCurrent.id],
    relationName: "taskRelationOwner",
  }),
  relatedTask: one(tasksCurrent, {
    fields: [taskRelations.relatedTaskId],
    references: [tasksCurrent.id],
    relationName: "taskRelationRelated",
  }),
}));

export const sessionsCurrentRelations = relations(sessionsCurrent, ({ one, many }) => ({
  task: one(tasksCurrent, {
    fields: [sessionsCurrent.taskId],
    references: [tasksCurrent.id],
  }),
  events: many(timelineEvents),
  runtimeBindings: many(runtimeSessionBindings),
}));

export const timelineEventsRelations = relations(timelineEvents, ({ one }) => ({
  task: one(tasksCurrent, {
    fields: [timelineEvents.taskId],
    references: [tasksCurrent.id],
  }),
  session: one(sessionsCurrent, {
    fields: [timelineEvents.sessionId],
    references: [sessionsCurrent.id],
  }),
}));

export const runtimeSessionBindingsRelations = relations(runtimeSessionBindings, ({ one }) => ({
  task: one(tasksCurrent, {
    fields: [runtimeSessionBindings.taskId],
    references: [tasksCurrent.id],
  }),
  session: one(sessionsCurrent, {
    fields: [runtimeSessionBindings.monitorSessionId],
    references: [sessionsCurrent.id],
  }),
}));

export const turnPartitionsRelations = relations(turnPartitions, ({ one }) => ({
  task: one(tasksCurrent, {
    fields: [turnPartitions.taskId],
    references: [tasksCurrent.id],
  }),
}));

export const rulesRelations = relations(rules, ({ one, many }) => ({
  task: one(tasksCurrent, {
    fields: [rules.taskId],
    references: [tasksCurrent.id],
  }),
  verdicts: many(verdicts),
  enforcements: many(ruleEnforcements),
}));

export const turnsRelations = relations(turns, ({ one, many }) => ({
  session: one(sessionsCurrent, {
    fields: [turns.sessionId],
    references: [sessionsCurrent.id],
  }),
  task: one(tasksCurrent, {
    fields: [turns.taskId],
    references: [tasksCurrent.id],
  }),
  events: many(turnEvents),
  verdicts: many(verdicts),
}));

export const turnEventsRelations = relations(turnEvents, ({ one }) => ({
  turn: one(turns, {
    fields: [turnEvents.turnId],
    references: [turns.id],
  }),
  event: one(timelineEvents, {
    fields: [turnEvents.eventId],
    references: [timelineEvents.id],
  }),
}));

export const verdictsRelations = relations(verdicts, ({ one }) => ({
  turn: one(turns, {
    fields: [verdicts.turnId],
    references: [turns.id],
  }),
  rule: one(rules, {
    fields: [verdicts.ruleId],
    references: [rules.id],
  }),
}));

export const ruleEnforcementsRelations = relations(ruleEnforcements, ({ one }) => ({
  event: one(timelineEvents, {
    fields: [ruleEnforcements.eventId],
    references: [timelineEvents.id],
  }),
  rule: one(rules, {
    fields: [ruleEnforcements.ruleId],
    references: [rules.id],
  }),
}));

export const drizzleSchema = {
  tasksCurrent,
  tasksCurrentRelations,
  taskRelations,
  taskRelationsRelations,
  sessionsCurrent,
  sessionsCurrentRelations,
  timelineEvents,
  timelineEventsRelations,
  runtimeSessionBindings,
  runtimeSessionBindingsRelations,
  searchDocuments,
  turnPartitions,
  turnPartitionsRelations,
  rules,
  rulesRelations,
  turns,
  turnsRelations,
  turnEvents,
  turnEventsRelations,
  verdicts,
  verdictsRelations,
  ruleEnforcements,
  ruleEnforcementsRelations,
};

export type DrizzleSchema = typeof drizzleSchema;
