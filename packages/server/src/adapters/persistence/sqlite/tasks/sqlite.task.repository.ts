import { count, eq, inArray, sql } from "drizzle-orm"
import type { MonitoringTask, TaskStatus } from "~domain/monitoring/index.js"
import { deriveTaskDisplayTitle } from "~domain/monitoring/index.js"
import type { ITaskRepository, TaskUpsertInput } from "~application/ports/repository/task.repository.js"
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js"
import { sessionsCurrent } from "../sessions/sqlite.session.tables.js"
import { timelineEvents } from "../timeline-events/sqlite.timeline-event.tables.js"
import { tasksCurrent } from "./sqlite.task.tables.js"
import { buildTaskSearchText, deleteSearchDocumentsByTaskIds, upsertSearchDocument } from "../search/sqlite.search.documents.js"
import { appendDomainEvent, eventTimeFromIso } from "../events/index.js"
import { type TaskRow, mapTaskRow } from "./sqlite.task.row.type.js"
import { loadTimelineEventsForTask } from "../timeline-events/sqlite.event.storage.js"

const TASK_ROW_SELECT = `
  select
    t.id as id,
    t.title as title,
    t.slug as slug,
    t.workspace_path as workspacePath,
    t.status as status,
    t.task_kind as taskKind,
    (
      select tr.related_task_id
      from task_relations tr
      where tr.task_id = t.id and tr.relation_kind = 'parent'
      limit 1
    ) as parentTaskId,
    (
      select tr.session_id
      from task_relations tr
      where tr.task_id = t.id and tr.relation_kind = 'spawned_by_session'
      limit 1
    ) as parentSessionId,
    (
      select tr.related_task_id
      from task_relations tr
      where tr.task_id = t.id and tr.relation_kind = 'background'
      limit 1
    ) as backgroundTaskId,
    t.created_at as createdAt,
    t.updated_at as updatedAt,
    t.last_session_started_at as lastSessionStartedAt,
    t.cli_source as cliSource
  from tasks_current t
`

export class SqliteTaskRepository implements ITaskRepository {
  private readonly db: SqliteDatabase

  constructor(db: SqliteDatabaseInput) {
    this.db = ensureSqliteDatabase(db)
  }

  private withDisplayTitle(task: MonitoringTask): MonitoringTask {
    const events = this.loadEventsForTitle(task)
    const displayTitle = deriveTaskDisplayTitle(task, events)
    return displayTitle ? { ...task, displayTitle } : task
  }

  private loadEventsForTitle(task: MonitoringTask) {
    return loadTimelineEventsForTask(this.db.client, task.id)
  }

  async upsert(input: TaskUpsertInput): Promise<MonitoringTask> {
    const existing = this.selectTaskRow(input.id)
    this.db.client.transaction(() => {
      this.appendTaskUpsertEvents(existing, input)
      this.refreshSearchDocument(input.id)
    })()
    const task = await this.findById(input.id)
    return task!
  }

  async findById(id: string): Promise<MonitoringTask | null> {
    const row = this.db.client
      .prepare<{ id: string }, TaskRow>(`${TASK_ROW_SELECT} where t.id = @id limit 1`)
      .get({ id })

    if (!row) {
      return null
    }

    return this.withDisplayTitle(mapTaskRow(row))
  }

  async findAll(): Promise<readonly MonitoringTask[]> {
    const rows = this.db.client
      .prepare<[], TaskRow>(`${TASK_ROW_SELECT} order by datetime(t.updated_at) desc`)
      .all()

    return rows.map((row) => this.withDisplayTitle(mapTaskRow(row)))
  }

  async findChildren(parentId: string): Promise<readonly MonitoringTask[]> {
    const rows = this.db.client
      .prepare<{ parentId: string }, TaskRow>(`
        ${TASK_ROW_SELECT}
        join task_relations parent_relation
          on parent_relation.task_id = t.id
         and parent_relation.relation_kind = 'parent'
         and parent_relation.related_task_id = @parentId
        order by datetime(t.updated_at) desc
      `)
      .all({ parentId })

    return rows.map((row) => this.withDisplayTitle(mapTaskRow(row)))
  }

  async updateStatus(id: string, status: MonitoringTask["status"], updatedAt: string): Promise<void> {
    const existing = this.selectTaskRow(id)
    this.db.client.transaction(() => {
      if (existing && existing.status !== status) {
        appendDomainEvent(this.db.client, {
          eventTime: eventTimeFromIso(updatedAt),
          eventType: "task.status_changed",
          schemaVer: 1,
          aggregateId: id,
          actor: "system",
          payload: { task_id: id, from: existing.status, to: status }
        })
      }
      this.refreshSearchDocument(id)
    })()
  }

  async updateTitle(id: string, title: string, slug: MonitoringTask["slug"], updatedAt: string): Promise<void> {
    const existing = this.selectTaskRow(id)
    this.db.client.transaction(() => {
      if (existing && existing.title !== title) {
        appendDomainEvent(this.db.client, {
          eventTime: eventTimeFromIso(updatedAt),
          eventType: "task.renamed",
          schemaVer: 1,
          aggregateId: id,
          actor: "user",
          payload: { task_id: id, from: existing.title, to: title, slug }
        })
      }
      this.refreshSearchDocument(id)
    })()
  }

  async delete(id: string): Promise<{ deletedIds: readonly string[] }> {
    return this.db.client.transaction(() => {
      const row = this.db.orm
        .select({ status: tasksCurrent.status })
        .from(tasksCurrent)
        .where(eq(tasksCurrent.id, id))
        .limit(1)
        .get()

      if (!row) {
        return { deletedIds: [] }
      }

      const taskIds = [id, ...this.collectDescendantIds(id)]
      this.deleteByIds(taskIds)
      return { deletedIds: taskIds }
    })()
  }

  async deleteFinished(): Promise<number> {
    const finishedIds = this.db.orm
      .select({ id: tasksCurrent.id })
      .from(tasksCurrent)
      .where(sql`${tasksCurrent.status} in ('completed', 'errored')`)
      .all()
      .map((row) => row.id)

    if (finishedIds.length === 0) {
      return 0
    }

    const allIds = new Set<string>()
    for (const finishedId of finishedIds) {
      allIds.add(finishedId)
      for (const descendantId of this.collectDescendantIds(finishedId)) {
        allIds.add(descendantId)
      }
    }

    this.deleteByIds([...allIds])
    return allIds.size
  }

  async listTaskStatuses(): Promise<readonly TaskStatus[]> {
    return this.db.orm
      .select({ status: tasksCurrent.status })
      .from(tasksCurrent)
      .all()
      .map((row) => row.status as TaskStatus)
  }

  async countTimelineEvents(): Promise<number> {
    const row = this.db.orm
      .select({ total: count() })
      .from(timelineEvents)
      .get()

    return row?.total ?? 0
  }

  private collectDescendantIds(taskId: string): readonly string[] {
    const rows = this.db.orm.all<{ id: string }>(sql`
      with recursive task_tree(id) as (
        select id from tasks_current where id = ${taskId}
        union all
        select relation.task_id
        from task_relations relation
        join task_tree parent on relation.related_task_id = parent.id
        where relation.relation_kind = 'parent'
      )
      select id from task_tree where id != ${taskId}
    `)

    return rows.map((row) => row.id)
  }

  private deleteByIds(taskIds: readonly string[]): void {
    if (taskIds.length === 0) {
      return
    }

    deleteSearchDocumentsByTaskIds(this.db, taskIds)
    this.db.orm.delete(sessionsCurrent).where(inArray(sessionsCurrent.taskId, taskIds)).run()
    this.db.orm.delete(tasksCurrent).where(inArray(tasksCurrent.id, taskIds)).run()
  }

  private selectTaskRow(id: string): TaskRow | undefined {
    return this.db.client
      .prepare<{ id: string }, TaskRow>(`${TASK_ROW_SELECT} where t.id = @id limit 1`)
      .get({ id })
  }

  private appendTaskUpsertEvents(existing: TaskRow | undefined, input: TaskUpsertInput): void {
    const eventTime = eventTimeFromIso(input.updatedAt)
    if (!existing) {
      appendDomainEvent(this.db.client, {
        eventTime: eventTimeFromIso(input.createdAt),
        eventType: "task.created",
        schemaVer: 1,
        aggregateId: input.id,
        actor: "user",
        payload: {
          task_id: input.id,
          title: input.title,
          slug: input.slug,
          kind: input.taskKind,
          ...(input.parentTaskId ? { parent_task_id: input.parentTaskId } : {}),
          ...(input.parentSessionId ? { parent_session_id: input.parentSessionId } : {}),
          ...(input.backgroundTaskId ? { background_task_id: input.backgroundTaskId } : {}),
          ...(input.workspacePath ? { workspace_path: input.workspacePath } : {}),
          ...(input.runtimeSource ? { cli_source: input.runtimeSource } : {})
        }
      })
      if (input.status !== "running") {
        appendDomainEvent(this.db.client, {
          eventTime,
          eventType: "task.status_changed",
          schemaVer: 1,
          aggregateId: input.id,
          actor: "system",
          payload: { task_id: input.id, from: "running", to: input.status }
        })
      }
      return
    }

    if (existing.status !== input.status) {
      appendDomainEvent(this.db.client, {
        eventTime,
        eventType: "task.status_changed",
        schemaVer: 1,
        aggregateId: input.id,
        actor: "system",
        payload: { task_id: input.id, from: existing.status, to: input.status }
      })
    }

    if (existing.title !== input.title) {
      appendDomainEvent(this.db.client, {
        eventTime,
        eventType: "task.renamed",
        schemaVer: 1,
        aggregateId: input.id,
        actor: "user",
        payload: { task_id: input.id, from: existing.title, to: input.title }
      })
    }

    const nextParent = input.parentTaskId ?? null
    const nextParentSession = input.parentSessionId ?? existing.parentSessionId ?? null
    const nextBackground = input.backgroundTaskId ?? existing.backgroundTaskId ?? null
    if (
      existing.parentTaskId !== nextParent ||
      existing.parentSessionId !== nextParentSession ||
      existing.backgroundTaskId !== nextBackground
    ) {
      appendDomainEvent(this.db.client, {
        eventTime,
        eventType: "task.hierarchy_changed",
        schemaVer: 1,
        aggregateId: input.id,
        actor: "user",
        payload: {
          task_id: input.id,
          ...(existing.parentTaskId ? { parent_task_id_from: existing.parentTaskId } : {}),
          ...(nextParent ? { parent_task_id_to: nextParent } : {}),
          ...(existing.parentSessionId ? { parent_session_id_from: existing.parentSessionId } : {}),
          ...(nextParentSession ? { parent_session_id_to: nextParentSession } : {}),
          ...(existing.backgroundTaskId ? { background_task_id_from: existing.backgroundTaskId } : {}),
          ...(nextBackground ? { background_task_id_to: nextBackground } : {})
        }
      })
    }
  }

  private refreshSearchDocument(taskId: string): void {
    const row = this.db.orm
      .select({
        id: tasksCurrent.id,
        title: tasksCurrent.title,
        workspacePath: tasksCurrent.workspacePath,
        cliSource: tasksCurrent.cliSource,
        updatedAt: tasksCurrent.updatedAt
      })
      .from(tasksCurrent)
      .where(eq(tasksCurrent.id, taskId))
      .limit(1)
      .get()

    if (!row) {
      return
    }

    upsertSearchDocument(this.db, {
      scope: "task",
      entityId: row.id,
      taskId: row.id,
      searchText: buildTaskSearchText({
        taskId: row.id,
        title: row.title,
        workspacePath: row.workspacePath,
        runtimeSource: row.cliSource
      }),
      updatedAt: row.updatedAt
    })
  }
}
