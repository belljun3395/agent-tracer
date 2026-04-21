import { relations } from "drizzle-orm"
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const tasksCurrent = sqliteTable("tasks_current", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  workspacePath: text("workspace_path"),
  status: text("status").notNull(),
  taskKind: text("task_kind").notNull(),
  parentTaskId: text("parent_task_id"),
  parentSessionId: text("parent_session_id"),
  backgroundTaskId: text("background_task_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  lastSessionStartedAt: text("last_session_started_at"),
  cliSource: text("cli_source")
}, (table) => [
  index("idx_tasks_current_updated").on(table.updatedAt),
  index("idx_tasks_current_parent").on(table.parentTaskId, table.updatedAt)
])

export const sessionsCurrent = sqliteTable("sessions_current", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  status: text("status").notNull(),
  summary: text("summary"),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at")
}, (table) => [
  index("idx_sessions_current_task_started").on(table.taskId, table.startedAt),
  index("idx_sessions_current_task_status_started").on(table.taskId, table.status, table.startedAt)
])

export const timelineEvents = sqliteTable("timeline_events_view", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasksCurrent.id, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => sessionsCurrent.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  lane: text("lane").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  metadataJson: text("metadata_json").notNull(),
  classificationJson: text("classification_json").notNull(),
  createdAt: text("created_at").notNull()
}, (table) => [
  index("idx_timeline_events_view_task_created").on(table.taskId, table.createdAt)
])

export const runtimeSessionBindings = sqliteTable("runtime_bindings_current", {
  runtimeSource: text("runtime_source").notNull(),
  runtimeSessionId: text("runtime_session_id").notNull(),
  taskId: text("task_id").notNull().references(() => tasksCurrent.id, { onDelete: "cascade" }),
  monitorSessionId: text("monitor_session_id").references(() => sessionsCurrent.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
}, (table) => [
  primaryKey({ columns: [table.runtimeSource, table.runtimeSessionId] })
])

export const bookmarks = sqliteTable("bookmarks_current", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasksCurrent.id, { onDelete: "cascade" }),
  eventId: text("event_id").references(() => timelineEvents.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  note: text("note"),
  metadataJson: text("metadata_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
}, (table) => [
  index("idx_bookmarks_task_created").on(table.taskId, table.updatedAt),
  index("idx_bookmarks_event").on(table.eventId)
])

export const searchDocuments = sqliteTable("search_documents", {
  scope: text("scope").notNull(),
  entityId: text("entity_id").notNull(),
  taskId: text("task_id"),
  searchText: text("search_text").notNull(),
  embedding: text("embedding"),
  embeddingModel: text("embedding_model"),
  updatedAt: text("updated_at").notNull()
}, (table) => [
  primaryKey({ columns: [table.scope, table.entityId] }),
  index("idx_search_documents_scope_task_updated").on(table.scope, table.taskId, table.updatedAt)
])

export const taskEvaluations = sqliteTable("evaluations_current", {
  taskId: text("task_id").notNull().references(() => tasksCurrent.id, { onDelete: "cascade" }),
  scopeKey: text("scope_key").notNull(),
  scopeKind: text("scope_kind").notNull(),
  scopeLabel: text("scope_label").notNull(),
  turnIndex: integer("turn_index"),
  rating: text("rating").notNull(),
  useCase: text("use_case"),
  workflowTags: text("workflow_tags"),
  outcomeNote: text("outcome_note"),
  approachNote: text("approach_note"),
  reuseWhen: text("reuse_when"),
  watchouts: text("watchouts"),
  version: integer("version").notNull(),
  promotedTo: text("promoted_to"),
  reuseCount: integer("reuse_count").notNull(),
  lastReusedAt: text("last_reused_at"),
  briefingCopyCount: integer("briefing_copy_count").notNull(),
  workflowSnapshotJson: text("workflow_snapshot_json"),
  workflowContext: text("workflow_context"),
  searchText: text("search_text"),
  embedding: text("embedding"),
  embeddingModel: text("embedding_model"),
  evaluatedAt: text("evaluated_at").notNull()
}, (table) => [
  primaryKey({ columns: [table.taskId, table.scopeKey] }),
  index("idx_evaluations_current_rating").on(table.rating)
])

export const playbooks = sqliteTable("playbooks_current", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  status: text("status").notNull(),
  whenToUse: text("when_to_use"),
  prerequisites: text("prerequisites"),
  approach: text("approach"),
  keySteps: text("key_steps"),
  watchouts: text("watchouts"),
  antiPatterns: text("anti_patterns"),
  failureModes: text("failure_modes"),
  variants: text("variants"),
  relatedPlaybookIds: text("related_playbook_ids"),
  sourceSnapshotIds: text("source_snapshot_ids"),
  tags: text("tags"),
  searchText: text("search_text"),
  embedding: text("embedding"),
  embeddingModel: text("embedding_model"),
  useCount: integer("use_count").notNull(),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
}, (table) => [
  index("idx_playbooks_status").on(table.status)
])

export const briefings = sqliteTable("briefings_current", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasksCurrent.id, { onDelete: "cascade" }),
  generatedAt: text("generated_at").notNull(),
  purpose: text("purpose").notNull(),
  format: text("format").notNull(),
  memo: text("memo"),
  content: text("content").notNull()
}, (table) => [
  index("idx_briefings_task_generated").on(table.taskId, table.generatedAt)
])

export const ruleCommands = sqliteTable("rule_commands_current", {
  id: text("id").primaryKey(),
  pattern: text("pattern").notNull(),
  label: text("label").notNull(),
  // null means global rule; non-null scopes the rule to one task.
  taskId: text("task_id").references(() => tasksCurrent.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_rule_commands_current_task_id").on(table.taskId)
])

export const tasksCurrentRelations = relations(tasksCurrent, ({ one, many }) => ({
  parent: one(tasksCurrent, {
    fields: [tasksCurrent.parentTaskId],
    references: [tasksCurrent.id],
    relationName: "taskHierarchy"
  }),
  children: many(tasksCurrent, { relationName: "taskHierarchy" }),
  sessions: many(sessionsCurrent),
  events: many(timelineEvents),
  runtimeBindings: many(runtimeSessionBindings),
  bookmarks: many(bookmarks),
  evaluations: many(taskEvaluations),
  briefings: many(briefings),
  ruleCommands: many(ruleCommands)
}))

export const sessionsCurrentRelations = relations(sessionsCurrent, ({ one, many }) => ({
  task: one(tasksCurrent, {
    fields: [sessionsCurrent.taskId],
    references: [tasksCurrent.id]
  }),
  events: many(timelineEvents),
  runtimeBindings: many(runtimeSessionBindings)
}))

export const timelineEventsRelations = relations(timelineEvents, ({ one, many }) => ({
  task: one(tasksCurrent, {
    fields: [timelineEvents.taskId],
    references: [tasksCurrent.id]
  }),
  session: one(sessionsCurrent, {
    fields: [timelineEvents.sessionId],
    references: [sessionsCurrent.id]
  }),
  bookmarks: many(bookmarks)
}))

export const runtimeSessionBindingsRelations = relations(runtimeSessionBindings, ({ one }) => ({
  task: one(tasksCurrent, {
    fields: [runtimeSessionBindings.taskId],
    references: [tasksCurrent.id]
  }),
  session: one(sessionsCurrent, {
    fields: [runtimeSessionBindings.monitorSessionId],
    references: [sessionsCurrent.id]
  })
}))

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  task: one(tasksCurrent, {
    fields: [bookmarks.taskId],
    references: [tasksCurrent.id]
  }),
  event: one(timelineEvents, {
    fields: [bookmarks.eventId],
    references: [timelineEvents.id]
  })
}))

export const taskEvaluationsRelations = relations(taskEvaluations, ({ one }) => ({
  task: one(tasksCurrent, {
    fields: [taskEvaluations.taskId],
    references: [tasksCurrent.id]
  })
}))

export const briefingsRelations = relations(briefings, ({ one }) => ({
  task: one(tasksCurrent, {
    fields: [briefings.taskId],
    references: [tasksCurrent.id]
  })
}))

export const ruleCommandsRelations = relations(ruleCommands, ({ one }) => ({
  task: one(tasksCurrent, {
    fields: [ruleCommands.taskId],
    references: [tasksCurrent.id]
  })
}))

export const drizzleSchema = {
  tasksCurrent,
  tasksCurrentRelations,
  sessionsCurrent,
  sessionsCurrentRelations,
  timelineEvents,
  timelineEventsRelations,
  runtimeSessionBindings,
  runtimeSessionBindingsRelations,
  bookmarks,
  bookmarksRelations,
  searchDocuments,
  taskEvaluations,
  taskEvaluationsRelations,
  playbooks,
  briefings,
  briefingsRelations,
  ruleCommands,
  ruleCommandsRelations,
}

export type DrizzleSchema = typeof drizzleSchema
