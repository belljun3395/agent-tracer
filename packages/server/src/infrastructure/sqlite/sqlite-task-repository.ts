import { asc, desc, eq, inArray, sql } from "drizzle-orm"
import type { EventClassification, MonitoringEventKind, MonitoringTask, MonitoringTaskKind, TimelineLane } from "@monitor/core"
import { EventId, RuntimeSource, SessionId, TaskId, TaskSlug, WorkspacePath } from "@monitor/core"

import type { ITaskRepository, OverviewStats, TaskUpsertInput } from "@monitor/application"
import { deriveTaskDisplayTitle } from "@monitor/application"
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "./drizzle-db.js"
import { monitoringTasks, timelineEvents } from "./drizzle-schema.js"
import { parseJsonField } from "./sqlite-json.js"
import { buildTaskSearchText, deleteSearchDocumentsByTaskIds, upsertSearchDocument } from "./sqlite-search-documents.js"

interface TaskRow {
  id: string
  title: string
  slug: string
  workspacePath: string | null
  status: string
  taskKind: string
  parentTaskId: string | null
  parentSessionId: string | null
  backgroundTaskId: string | null
  createdAt: string
  updatedAt: string
  lastSessionStartedAt: string | null
  cliSource: string | null
}

interface EventKindRow {
  id: string
  lane: string
  kind: string
  title: string
  body: string | null
  metadataJson: string
  classificationJson: string
  createdAt: string
  taskId: string
  sessionId: string | null
}

function mapTaskRow(row: TaskRow): MonitoringTask {
  return {
    id: TaskId(row.id),
    title: row.title,
    slug: TaskSlug(row.slug),
    status: row.status as MonitoringTask["status"],
    taskKind: row.taskKind as MonitoringTaskKind,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.workspacePath ? { workspacePath: WorkspacePath(row.workspacePath) } : {}),
    ...(row.parentTaskId ? { parentTaskId: TaskId(row.parentTaskId) } : {}),
    ...(row.parentSessionId ? { parentSessionId: SessionId(row.parentSessionId) } : {}),
    ...(row.backgroundTaskId ? { backgroundTaskId: TaskId(row.backgroundTaskId) } : {}),
    ...(row.lastSessionStartedAt ? { lastSessionStartedAt: row.lastSessionStartedAt } : {}),
    ...(row.cliSource ? { runtimeSource: RuntimeSource(row.cliSource) } : {})
  }
}

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

    return rows.map((row) => ({
      id: EventId(row.id),
      taskId: TaskId(row.taskId),
      kind: row.kind as MonitoringEventKind,
      lane: row.lane as TimelineLane,
      title: row.title,
      metadata: parseJsonField<Record<string, unknown>>(row.metadataJson),
      classification: parseJsonField<EventClassification>(row.classificationJson),
      createdAt: row.createdAt,
      ...(row.sessionId ? { sessionId: SessionId(row.sessionId) } : {}),
      ...(row.body ? { body: row.body } : {})
    }))
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

  async findById(id: TaskId): Promise<MonitoringTask | null> {
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

  async findChildren(parentId: TaskId): Promise<readonly MonitoringTask[]> {
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

  async updateStatus(id: TaskId, status: MonitoringTask["status"], updatedAt: string): Promise<void> {
    this.db.orm
      .update(monitoringTasks)
      .set({ status, updatedAt })
      .where(eq(monitoringTasks.id, id))
      .run()

    this.refreshSearchDocument(id)
  }

  async updateTitle(id: TaskId, title: string, slug: MonitoringTask["slug"], updatedAt: string): Promise<void> {
    this.db.orm
      .update(monitoringTasks)
      .set({ title, slug, updatedAt })
      .where(eq(monitoringTasks.id, id))
      .run()

    this.refreshSearchDocument(id)
  }

  async delete(id: TaskId): Promise<{ deletedIds: readonly TaskId[] }> {
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
      .map((row) => TaskId(row.id))

    if (finishedIds.length === 0) {
      return 0
    }

    const allIds = new Set<TaskId>()
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

  private collectDescendantIds(taskId: TaskId): readonly TaskId[] {
    const rows = this.db.orm.all<{ id: string }>(sql`
      with recursive task_tree(id) as (
        select id from monitoring_tasks where id = ${taskId}
        union all
        select child.id from monitoring_tasks child join task_tree parent on child.parent_task_id = parent.id
      )
      select id from task_tree where id != ${taskId}
    `)

    return rows.map((row) => TaskId(row.id))
  }

  private deleteByIds(taskIds: readonly TaskId[]): void {
    if (taskIds.length === 0) {
      return
    }

    deleteSearchDocumentsByTaskIds(this.db, taskIds)
    this.db.orm.delete(monitoringTasks).where(inArray(monitoringTasks.id, taskIds)).run()
  }

  private refreshSearchDocument(taskId: TaskId): void {
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
