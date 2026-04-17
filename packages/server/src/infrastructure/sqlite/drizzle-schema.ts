import { index, integer, primaryKey, sqliteTable, text, type AnySQLiteColumn } from "drizzle-orm/sqlite-core"

export const monitoringTasks = sqliteTable("monitoring_tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  workspacePath: text("workspace_path"),
  status: text("status").notNull(),
  taskKind: text("task_kind").notNull(),
  parentTaskId: text("parent_task_id").references((): AnySQLiteColumn => monitoringTasks.id, { onDelete: "cascade" }),
  parentSessionId: text("parent_session_id"),
  backgroundTaskId: text("background_task_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  lastSessionStartedAt: text("last_session_started_at"),
  cliSource: text("cli_source")
})

export const taskSessions = sqliteTable("task_sessions", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => monitoringTasks.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  summary: text("summary"),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at")
})

export const timelineEvents = sqliteTable("timeline_events", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => monitoringTasks.id, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => taskSessions.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  lane: text("lane").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  metadataJson: text("metadata_json").notNull(),
  classificationJson: text("classification_json").notNull(),
  createdAt: text("created_at").notNull()
}, (table) => [
  index("idx_timeline_events_task_created").on(table.taskId, table.createdAt)
])

export const runtimeSessionBindings = sqliteTable("runtime_session_bindings", {
  runtimeSource: text("runtime_source").notNull(),
  runtimeSessionId: text("runtime_session_id").notNull(),
  taskId: text("task_id").notNull().references(() => monitoringTasks.id, { onDelete: "cascade" }),
  monitorSessionId: text("monitor_session_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
}, (table) => [
  primaryKey({ columns: [table.runtimeSource, table.runtimeSessionId] })
])

export const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => monitoringTasks.id, { onDelete: "cascade" }),
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

export const taskEvaluations = sqliteTable("task_evaluations", {
  taskId: text("task_id").notNull().references(() => monitoringTasks.id, { onDelete: "cascade" }),
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
  index("idx_task_evaluations_rating").on(table.rating)
])

export const playbooks = sqliteTable("playbooks", {
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

export const briefings = sqliteTable("briefings", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => monitoringTasks.id, { onDelete: "cascade" }),
  generatedAt: text("generated_at").notNull(),
  purpose: text("purpose").notNull(),
  format: text("format").notNull(),
  memo: text("memo"),
  content: text("content").notNull()
}, (table) => [
  index("idx_briefings_task_generated").on(table.taskId, table.generatedAt)
])

export const drizzleSchema = {
  monitoringTasks,
  taskSessions,
  timelineEvents,
  runtimeSessionBindings,
  bookmarks,
  searchDocuments,
  taskEvaluations,
  playbooks,
  briefings
}

export type DrizzleSchema = typeof drizzleSchema
