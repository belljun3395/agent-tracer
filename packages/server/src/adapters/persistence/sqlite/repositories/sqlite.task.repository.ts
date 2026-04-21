import { asc, desc, eq, inArray, sql } from "drizzle-orm"
import type { MonitoringTask } from "~domain/monitoring/monitoring.task.model.js"
import type { ITaskRepository, OverviewStats, TaskUpsertInput } from "~application/ports/repository/task.repository.js"
import { deriveTaskDisplayTitle } from "~application/tasks/services/task.display.title.service.js"
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js"
import { sessionsCurrent, tasksCurrent, timelineEvents } from "../schema/drizzle.schema.js"
import { buildTaskSearchText, deleteSearchDocumentsByTaskIds, upsertSearchDocument } from "../search/sqlite.search.documents.js"
import { appendDomainEvent, eventTimeFromIso } from "../events/index.js"
import { type EventKindRow, type TaskRow, mapEventKindRow, mapTaskRow } from "./sqlite.task.row.type.js"

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
    const rows = this.db.orm
      .select({
        id: timelineEvents.id,
        taskId: timelineEvents.taskId,
        sessionId: timelineEvents.sessionId,
        kind: timelineEvents.kind,
        lane: timelineEvents.lane,
        title: timelineEvents.title,
        body: timelineEvents.body,
        metadataJson: timelineEvents.metadataJson,
        classificationJson: timelineEvents.classificationJson,
        createdAt: timelineEvents.createdAt
      })
      .from(timelineEvents)
      .where(eq(timelineEvents.taskId, task.id))
      .orderBy(asc(timelineEvents.createdAt))
      .all() as readonly EventKindRow[]

    return rows.map(mapEventKindRow)
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
    const row = this.db.orm
      .select({
        id: tasksCurrent.id,
        title: tasksCurrent.title,
        slug: tasksCurrent.slug,
        workspacePath: tasksCurrent.workspacePath,
        status: tasksCurrent.status,
        taskKind: tasksCurrent.taskKind,
        parentTaskId: tasksCurrent.parentTaskId,
        parentSessionId: tasksCurrent.parentSessionId,
        backgroundTaskId: tasksCurrent.backgroundTaskId,
        createdAt: tasksCurrent.createdAt,
        updatedAt: tasksCurrent.updatedAt,
        lastSessionStartedAt: tasksCurrent.lastSessionStartedAt,
        cliSource: tasksCurrent.cliSource
      })
      .from(tasksCurrent)
      .where(eq(tasksCurrent.id, id))
      .limit(1)
      .get() as TaskRow | undefined

    if (!row) {
      return null
    }

    return this.withDisplayTitle(mapTaskRow(row))
  }

  async findAll(): Promise<readonly MonitoringTask[]> {
    const rows = this.db.orm
      .select({
        id: tasksCurrent.id,
        title: tasksCurrent.title,
        slug: tasksCurrent.slug,
        workspacePath: tasksCurrent.workspacePath,
        status: tasksCurrent.status,
        taskKind: tasksCurrent.taskKind,
        parentTaskId: tasksCurrent.parentTaskId,
        parentSessionId: tasksCurrent.parentSessionId,
        backgroundTaskId: tasksCurrent.backgroundTaskId,
        createdAt: tasksCurrent.createdAt,
        updatedAt: tasksCurrent.updatedAt,
        lastSessionStartedAt: tasksCurrent.lastSessionStartedAt,
        cliSource: tasksCurrent.cliSource
      })
      .from(tasksCurrent)
      .orderBy(desc(tasksCurrent.updatedAt))
      .all() as readonly TaskRow[]

    return rows.map((row) => this.withDisplayTitle(mapTaskRow(row)))
  }

  async findChildren(parentId: string): Promise<readonly MonitoringTask[]> {
    const rows = this.db.orm
      .select({
        id: tasksCurrent.id,
        title: tasksCurrent.title,
        slug: tasksCurrent.slug,
        workspacePath: tasksCurrent.workspacePath,
        status: tasksCurrent.status,
        taskKind: tasksCurrent.taskKind,
        parentTaskId: tasksCurrent.parentTaskId,
        parentSessionId: tasksCurrent.parentSessionId,
        backgroundTaskId: tasksCurrent.backgroundTaskId,
        createdAt: tasksCurrent.createdAt,
        updatedAt: tasksCurrent.updatedAt,
        lastSessionStartedAt: tasksCurrent.lastSessionStartedAt,
        cliSource: tasksCurrent.cliSource
      })
      .from(tasksCurrent)
      .where(eq(tasksCurrent.parentTaskId, parentId))
      .orderBy(desc(tasksCurrent.updatedAt))
      .all() as readonly TaskRow[]

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

  async getOverviewStats(): Promise<OverviewStats> {
    const counts = this.db.orm
      .select({
        totalTasks: sql<number>`cast(count(*) as int)`,
        runningTasks: sql<number | null>`cast(sum(case when ${tasksCurrent.status} = 'running' then 1 else 0 end) as int)`,
        waitingTasks: sql<number | null>`cast(sum(case when ${tasksCurrent.status} = 'waiting' then 1 else 0 end) as int)`,
        completedTasks: sql<number | null>`cast(sum(case when ${tasksCurrent.status} = 'completed' then 1 else 0 end) as int)`,
        erroredTasks: sql<number | null>`cast(sum(case when ${tasksCurrent.status} = 'errored' then 1 else 0 end) as int)`,
        totalEvents: sql<number>`(select cast(count(*) as int) from timeline_events_view)`
      })
      .from(tasksCurrent)
      .get()

    return {
      totalTasks: counts?.totalTasks ?? 0,
      runningTasks: counts?.runningTasks ?? 0,
      waitingTasks: counts?.waitingTasks ?? 0,
      completedTasks: counts?.completedTasks ?? 0,
      erroredTasks: counts?.erroredTasks ?? 0,
      totalEvents: counts?.totalEvents ?? 0
    }
  }

  private collectDescendantIds(taskId: string): readonly string[] {
    const rows = this.db.orm.all<{ id: string }>(sql`
      with recursive task_tree(id) as (
        select id from tasks_current where id = ${taskId}
        union all
        select child.id from tasks_current child join task_tree parent on child.parent_task_id = parent.id
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
    return this.db.orm
      .select({
        id: tasksCurrent.id,
        title: tasksCurrent.title,
        slug: tasksCurrent.slug,
        workspacePath: tasksCurrent.workspacePath,
        status: tasksCurrent.status,
        taskKind: tasksCurrent.taskKind,
        parentTaskId: tasksCurrent.parentTaskId,
        parentSessionId: tasksCurrent.parentSessionId,
        backgroundTaskId: tasksCurrent.backgroundTaskId,
        createdAt: tasksCurrent.createdAt,
        updatedAt: tasksCurrent.updatedAt,
        lastSessionStartedAt: tasksCurrent.lastSessionStartedAt,
        cliSource: tasksCurrent.cliSource
      })
      .from(tasksCurrent)
      .where(eq(tasksCurrent.id, id))
      .limit(1)
      .get() as TaskRow | undefined
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
    if (existing.parentTaskId !== nextParent) {
      appendDomainEvent(this.db.client, {
        eventTime,
        eventType: "task.hierarchy_changed",
        schemaVer: 1,
        aggregateId: input.id,
        actor: "user",
        payload: {
          task_id: input.id,
          ...(existing.parentTaskId ? { parent_task_id_from: existing.parentTaskId } : {}),
          ...(nextParent ? { parent_task_id_to: nextParent } : {})
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
