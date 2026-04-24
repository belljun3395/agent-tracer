import type Database from "better-sqlite3";
import type { DomainEvent } from "~domain/events/index.js";

function isoFromMs(value: number): string {
    return new Date(value).toISOString();
}

function getString(payload: Record<string, unknown>, key: string): string | null {
    const value = payload[key];
    return typeof value === "string" ? value : null;
}

export function projectDomainEvent(db: Database.Database, event: DomainEvent): void {
    switch (event.eventType) {
        case "task.created":
            projectTaskCreated(db, event);
            return;
        case "task.renamed":
            projectTaskRenamed(db, event);
            return;
        case "task.status_changed":
            projectTaskStatusChanged(db, event);
            return;
        case "task.hierarchy_changed":
            projectTaskHierarchyChanged(db, event);
            return;
        case "session.started":
            projectSessionStarted(db, event);
            return;
        case "session.ended":
            projectSessionEnded(db, event);
            return;
        default:
            return;
    }
}

function projectTaskCreated(db: Database.Database, event: DomainEvent): void {
    db.prepare(`
      insert into tasks_current (
        id, title, slug, workspace_path, status, task_kind, created_at, updated_at,
        last_session_started_at, cli_source
      ) values (
        @id, @title, @slug, @workspacePath, @status, @taskKind, @createdAt, @updatedAt,
        null, @cliSource
      )
      on conflict(id) do update set
        title = excluded.title,
        slug = excluded.slug,
        workspace_path = excluded.workspace_path,
        task_kind = excluded.task_kind,
        updated_at = excluded.updated_at,
        cli_source = coalesce(excluded.cli_source, tasks_current.cli_source)
    `).run({
        id: getString(event.payload, "task_id") ?? event.aggregateId,
        title: getString(event.payload, "title") ?? "Untitled task",
        slug: getString(event.payload, "slug") ?? event.aggregateId,
        workspacePath: getString(event.payload, "workspace_path"),
        status: "running",
        taskKind: getString(event.payload, "kind") ?? "primary",
        createdAt: isoFromMs(event.eventTime),
        updatedAt: isoFromMs(event.eventTime),
        cliSource: getString(event.payload, "cli_source"),
    });
    syncTaskRelations(db, getString(event.payload, "task_id") ?? event.aggregateId, {
        parentTaskId: getString(event.payload, "parent_task_id"),
        parentSessionId: getString(event.payload, "parent_session_id"),
        backgroundTaskId: getString(event.payload, "background_task_id"),
    });
}

function projectTaskRenamed(db: Database.Database, event: DomainEvent): void {
    db.prepare(`
      update tasks_current
      set title = @title,
          slug = coalesce(@slug, slug),
          updated_at = @updatedAt
      where id = @id
    `).run({
        id: getString(event.payload, "task_id") ?? event.aggregateId,
        title: getString(event.payload, "to") ?? "Untitled task",
        slug: getString(event.payload, "slug"),
        updatedAt: isoFromMs(event.eventTime),
    });
}

function projectTaskStatusChanged(db: Database.Database, event: DomainEvent): void {
    db.prepare(`
      update tasks_current
      set status = @status,
          updated_at = @updatedAt
      where id = @id
    `).run({
        id: getString(event.payload, "task_id") ?? event.aggregateId,
        status: getString(event.payload, "to") ?? "running",
        updatedAt: isoFromMs(event.eventTime),
    });
}

function projectTaskHierarchyChanged(db: Database.Database, event: DomainEvent): void {
    db.prepare(`
      update tasks_current
      set updated_at = @updatedAt
      where id = @id
    `).run({
        id: getString(event.payload, "task_id") ?? event.aggregateId,
        updatedAt: isoFromMs(event.eventTime),
    });
    syncTaskRelations(db, getString(event.payload, "task_id") ?? event.aggregateId, {
        parentTaskId: getString(event.payload, "parent_task_id_to"),
        parentSessionId: getString(event.payload, "parent_session_id_to"),
        backgroundTaskId: getString(event.payload, "background_task_id_to"),
    });
}

function projectSessionStarted(db: Database.Database, event: DomainEvent): void {
    db.prepare(`
      insert into sessions_current (
        id, task_id, status, summary, started_at, ended_at
      ) values (
        @id, @taskId, 'running', null, @startedAt, null
      )
      on conflict(id) do update set
        task_id = excluded.task_id,
        status = excluded.status,
        started_at = excluded.started_at
    `).run({
        id: getString(event.payload, "session_id") ?? event.sessionId,
        taskId: getString(event.payload, "task_id") ?? event.aggregateId,
        startedAt: isoFromMs(event.eventTime),
    });

    db.prepare(`
      update tasks_current
      set last_session_started_at = @startedAt,
          updated_at = case when updated_at < @startedAt then @startedAt else updated_at end
      where id = @taskId
    `).run({
        taskId: getString(event.payload, "task_id") ?? event.aggregateId,
        startedAt: isoFromMs(event.eventTime),
    });
}

function projectSessionEnded(db: Database.Database, event: DomainEvent): void {
    db.prepare(`
      update sessions_current
      set status = @status,
          summary = coalesce(@summary, summary),
          ended_at = @endedAt
      where id = @id
    `).run({
        id: getString(event.payload, "session_id") ?? event.sessionId,
        status: getString(event.payload, "outcome") ?? "completed",
        summary: getString(event.payload, "summary"),
        endedAt: isoFromMs(event.eventTime),
    });
}

function syncTaskRelations(
    db: Database.Database,
    taskId: string,
    relations: {
        readonly parentTaskId?: string | null;
        readonly parentSessionId?: string | null;
        readonly backgroundTaskId?: string | null;
    },
): void {
    syncTaskRelation(db, taskId, "parent", relations.parentTaskId ?? null, null);
    syncTaskRelation(db, taskId, "spawned_by_session", null, relations.parentSessionId ?? null);
    syncTaskRelation(db, taskId, "background", relations.backgroundTaskId ?? null, null);
}

function syncTaskRelation(
    db: Database.Database,
    taskId: string,
    relationKind: "parent" | "background" | "spawned_by_session",
    relatedTaskId: string | null,
    sessionId: string | null,
): void {
    db.prepare(`
      delete from task_relations
      where task_id = @taskId and relation_kind = @relationKind
    `).run({ taskId, relationKind });

    if (!relatedTaskId && !sessionId) {
        return;
    }

    db.prepare(`
      insert into task_relations (task_id, related_task_id, relation_kind, session_id)
      values (@taskId, @relatedTaskId, @relationKind, @sessionId)
    `).run({ taskId, relatedTaskId, relationKind, sessionId });
}
