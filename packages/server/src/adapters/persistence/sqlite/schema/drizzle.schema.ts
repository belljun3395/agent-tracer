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

export const evaluationsCore = sqliteTable("evaluations_core", {
  taskId: text("task_id").notNull().references(() => tasksCurrent.id, { onDelete: "cascade" }),
  scopeKey: text("scope_key").notNull(),
  scopeKind: text("scope_kind").notNull(),
  scopeLabel: text("scope_label").notNull(),
  turnIndex: integer("turn_index"),
  rating: text("rating").notNull(),
  version: integer("version").notNull(),
  evaluatedAt: text("evaluated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.taskId, table.scopeKey] }),
  index("idx_evaluations_core_rating").on(table.rating),
]);

export const turnPartitions = sqliteTable("turn_partitions_current", {
  taskId: text("task_id").primaryKey().references(() => tasksCurrent.id, { onDelete: "cascade" }),
  groupsJson: text("groups_json").notNull(),
  version: integer("version").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const rulesCurrent = sqliteTable("rules_current", {
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
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_rules_current_scope_task").on(table.scope, table.taskId),
]);

export const appConfig = sqliteTable("app_config", {
    key: text("key").primaryKey(),
    valueJson: text("value_json").notNull(),
    updatedAt: text("updated_at").notNull(),
});

export const turnsCurrent = sqliteTable("turns_current", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessionsCurrent.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at").notNull(),
  assistantText: text("assistant_text").notNull(),
  summaryMarkdown: text("summary_markdown"),
  rulesEvaluatedCount: integer("rules_evaluated_count").notNull().default(0),
  aggregateVerdict: text("aggregate_verdict"),
}, (table) => [
  index("idx_turns_current_session_index").on(table.sessionId, table.index),
  index("idx_turns_current_session_started").on(table.sessionId, table.startedAt),
]);

export const turnEventLinks = sqliteTable("turn_event_links", {
  turnId: text("turn_id").notNull().references(() => turnsCurrent.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull().references(() => timelineEvents.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.turnId, table.eventId] }),
  index("idx_turn_event_links_event").on(table.eventId),
]);

export const turnVerdicts = sqliteTable("turn_verdicts", {
  id: text("id").primaryKey(),
  turnId: text("turn_id").notNull().references(() => turnsCurrent.id, { onDelete: "cascade" }),
  ruleId: text("rule_id").notNull(),
  status: text("status").notNull(),
  detailJson: text("detail_json").notNull().default("{}"),
  acknowledged: integer("acknowledged").notNull().default(0),
  evaluatedAt: text("evaluated_at").notNull(),
}, (table) => [
  index("idx_turn_verdicts_turn").on(table.turnId),
  index("idx_turn_verdicts_rule").on(table.ruleId),
]);

export const tasksCurrentRelations = relations(tasksCurrent, ({ many }) => ({
  sessions: many(sessionsCurrent),
  events: many(timelineEvents),
  runtimeBindings: many(runtimeSessionBindings),
  evaluations: many(evaluationsCore),
  rules: many(rulesCurrent),
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

export const evaluationsCoreRelations = relations(evaluationsCore, ({ one }) => ({
  task: one(tasksCurrent, {
    fields: [evaluationsCore.taskId],
    references: [tasksCurrent.id],
  }),
}));

export const rulesCurrentRelations = relations(rulesCurrent, ({ one }) => ({
  task: one(tasksCurrent, {
    fields: [rulesCurrent.taskId],
    references: [tasksCurrent.id],
  }),
}));

export const turnPartitionsRelations = relations(turnPartitions, ({ one }) => ({
  task: one(tasksCurrent, {
    fields: [turnPartitions.taskId],
    references: [tasksCurrent.id],
  }),
}));

export const turnsCurrentRelations = relations(turnsCurrent, ({ one, many }) => ({
  session: one(sessionsCurrent, {
    fields: [turnsCurrent.sessionId],
    references: [sessionsCurrent.id],
  }),
  eventLinks: many(turnEventLinks),
  verdicts: many(turnVerdicts),
}));

export const turnEventLinksRelations = relations(turnEventLinks, ({ one }) => ({
  turn: one(turnsCurrent, {
    fields: [turnEventLinks.turnId],
    references: [turnsCurrent.id],
  }),
  event: one(timelineEvents, {
    fields: [turnEventLinks.eventId],
    references: [timelineEvents.id],
  }),
}));

export const turnVerdictsRelations = relations(turnVerdicts, ({ one }) => ({
  turn: one(turnsCurrent, {
    fields: [turnVerdicts.turnId],
    references: [turnsCurrent.id],
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
  evaluationsCore,
  evaluationsCoreRelations,
  rulesCurrent,
  rulesCurrentRelations,
  appConfig,
  turnPartitions,
  turnPartitionsRelations,
  turnsCurrent,
  turnsCurrentRelations,
  turnEventLinks,
  turnEventLinksRelations,
  turnVerdicts,
  turnVerdictsRelations,
};

export type DrizzleSchema = typeof drizzleSchema;
