import { asc, desc, eq, inArray, sql } from "drizzle-orm"
import type { MonitoringTask } from "~domain/monitoring/monitoring.task.model.js"
import type { ITaskRepository, OverviewStats, TaskUpsertInput } from "~application/ports/repository/task.repository.js"
import { deriveTaskDisplayTitle } from "~application/tasks/services/task.display.title.service.js"
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js"
import { monitoringTasks, timelineEvents } from "../schema/drizzle.schema.js"
import { buildTaskSearchText, deleteSearchDocumentsByTaskIds, upsertSearchDocument } from "../search/sqlite.search.documents.js"
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
    this.db.orm
      .insert(monitoringTasks)
      .values({
        id: input.id,
        title: input.title,
        slug: input.slug,
        workspacePath: input.workspacePath ?? null,
        status: input.status,
        taskKind: input.taskKind,
        parentTaskId: input.parentTaskId ?? null,
        parentSessionId: input.parentSessionId ?? null,
        backgroundTaskId: input.backgroundTaskId ?? null,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
        lastSessionStartedAt: input.lastSessionStartedAt ?? null,
        cliSource: input.runtimeSource ?? null
      })
      .onConflictDoUpdate({
        target: monitoringTasks.id,
        set: {
          title: input.title,
          slug: input.slug,
          workspacePath: input.workspacePath ?? null,
          status: input.status,
          taskKind: input.taskKind,
          parentTaskId: input.parentTaskId ?? null,
          parentSessionId: input.parentSessionId ?? null,
          backgroundTaskId: input.backgroundTaskId ?? null,
          updatedAt: input.updatedAt,
          lastSessionStartedAt: input.lastSessionStartedAt ?? null,
          cliSource: sql`coalesce(excluded.cli_source, monitoring_tasks.cli_source)`
        }
      })
      .run()

    this.refreshSearchDocument(input.id)
    const task = await this.findById(input.id)
    return task!
  }

  async findById(id: string): Promise<MonitoringTask | null> {
    const row = this.db.orm
      .select({
        id: monitoringTasks.id,
        title: monitoringTasks.title,
        slug: monitoringTasks.slug,
        workspacePath: monitoringTasks.workspacePath,
        status: monitoringTasks.status,
        taskKind: monitoringTasks.taskKind,
        parentTaskId: monitoringTasks.parentTaskId,
        parentSessionId: monitoringTasks.parentSessionId,
        backgroundTaskId: monitoringTasks.backgroundTaskId,
        createdAt: monitoringTasks.createdAt,
        updatedAt: monitoringTasks.updatedAt,
        lastSessionStartedAt: monitoringTasks.lastSessionStartedAt,
        cliSource: monitoringTasks.cliSource
      })
      .from(monitoringTasks)
      .where(eq(monitoringTasks.id, id))
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
        id: monitoringTasks.id,
        title: monitoringTasks.title,
        slug: monitoringTasks.slug,
        workspacePath: monitoringTasks.workspacePath,
        status: monitoringTasks.status,
        taskKind: monitoringTasks.taskKind,
        parentTaskId: monitoringTasks.parentTaskId,
        parentSessionId: monitoringTasks.parentSessionId,
        backgroundTaskId: monitoringTasks.backgroundTaskId,
        createdAt: monitoringTasks.createdAt,
        updatedAt: monitoringTasks.updatedAt,
        lastSessionStartedAt: monitoringTasks.lastSessionStartedAt,
        cliSource: monitoringTasks.cliSource
      })
      .from(monitoringTasks)
      .orderBy(desc(monitoringTasks.updatedAt))
      .all() as readonly TaskRow[]

    return rows.map((row) => this.withDisplayTitle(mapTaskRow(row)))
  }

  async findChildren(parentId: string): Promise<readonly MonitoringTask[]> {
    const rows = this.db.orm
      .select({
        id: monitoringTasks.id,
        title: monitoringTasks.title,
        slug: monitoringTasks.slug,
        workspacePath: monitoringTasks.workspacePath,
        status: monitoringTasks.status,
        taskKind: monitoringTasks.taskKind,
        parentTaskId: monitoringTasks.parentTaskId,
        parentSessionId: monitoringTasks.parentSessionId,
        backgroundTaskId: monitoringTasks.backgroundTaskId,
        createdAt: monitoringTasks.createdAt,
        updatedAt: monitoringTasks.updatedAt,
        lastSessionStartedAt: monitoringTasks.lastSessionStartedAt,
        cliSource: monitoringTasks.cliSource
      })
      .from(monitoringTasks)
      .where(eq(monitoringTasks.parentTaskId, parentId))
      .orderBy(desc(monitoringTasks.updatedAt))
      .all() as readonly TaskRow[]

    return rows.map((row) => this.withDisplayTitle(mapTaskRow(row)))
  }

  async updateStatus(id: string, status: MonitoringTask["status"], updatedAt: string): Promise<void> {
    this.db.orm
      .update(monitoringTasks)
      .set({ status, updatedAt })
      .where(eq(monitoringTasks.id, id))
      .run()

    this.refreshSearchDocument(id)
  }

  async updateTitle(id: string, title: string, slug: MonitoringTask["slug"], updatedAt: string): Promise<void> {
    this.db.orm
      .update(monitoringTasks)
      .set({ title, slug, updatedAt })
      .where(eq(monitoringTasks.id, id))
      .run()

    this.refreshSearchDocument(id)
  }

  async delete(id: string): Promise<{ deletedIds: readonly string[] }> {
    return this.db.client.transaction(() => {
      const row = this.db.orm
        .select({ status: monitoringTasks.status })
        .from(monitoringTasks)
        .where(eq(monitoringTasks.id, id))
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
      .select({ id: monitoringTasks.id })
      .from(monitoringTasks)
      .where(sql`${monitoringTasks.status} in ('completed', 'errored')`)
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
        runningTasks: sql<number | null>`cast(sum(case when ${monitoringTasks.status} = 'running' then 1 else 0 end) as int)`,
        waitingTasks: sql<number | null>`cast(sum(case when ${monitoringTasks.status} = 'waiting' then 1 else 0 end) as int)`,
        completedTasks: sql<number | null>`cast(sum(case when ${monitoringTasks.status} = 'completed' then 1 else 0 end) as int)`,
        erroredTasks: sql<number | null>`cast(sum(case when ${monitoringTasks.status} = 'errored' then 1 else 0 end) as int)`,
        totalEvents: sql<number>`(select cast(count(*) as int) from timeline_events)`
      })
      .from(monitoringTasks)
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
        select id from monitoring_tasks where id = ${taskId}
        union all
        select child.id from monitoring_tasks child join task_tree parent on child.parent_task_id = parent.id
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
    this.db.orm.delete(monitoringTasks).where(inArray(monitoringTasks.id, taskIds)).run()
  }

  private refreshSearchDocument(taskId: string): void {
    const row = this.db.orm
      .select({
        id: monitoringTasks.id,
        title: monitoringTasks.title,
        workspacePath: monitoringTasks.workspacePath,
        cliSource: monitoringTasks.cliSource,
        updatedAt: monitoringTasks.updatedAt
      })
      .from(monitoringTasks)
      .where(eq(monitoringTasks.id, taskId))
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
        title: row.title,
        workspacePath: row.workspacePath,
        runtimeSource: row.cliSource
      }),
      updatedAt: row.updatedAt
    })
  }
}
