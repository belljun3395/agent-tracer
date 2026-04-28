import type { EntityManager } from "typeorm";
import type { DomainEvent } from "~activity/event/domain/event-store/model/domain.events.model.js";

/**
 * Driver-portable read-model projection. Receives the same EntityManager that
 * the caller is using (typically inside a TypeORM transaction) and writes
 * directly via that manager so the event-write and the projection stay
 * atomic.
 */

function isoFromMs(value: number): string {
    return new Date(value).toISOString();
}

function getString(payload: Record<string, unknown>, key: string): string | null {
    const value = payload[key];
    return typeof value === "string" ? value : null;
}

export async function projectDomainEvent(manager: EntityManager, event: DomainEvent): Promise<void> {
    switch (event.eventType) {
        case "task.created":
            await projectTaskCreated(manager, event);
            return;
        case "task.renamed":
            await projectTaskRenamed(manager, event);
            return;
        case "task.status_changed":
            await projectTaskStatusChanged(manager, event);
            return;
        case "task.hierarchy_changed":
            await projectTaskHierarchyChanged(manager, event);
            return;
        // session.started / session.ended are written directly by SessionEntity
        // via the session module's TypeORM subscriber - no projection needed.
        default:
            return;
    }
}

async function projectTaskCreated(manager: EntityManager, event: DomainEvent): Promise<void> {
    const taskId = getString(event.payload, "task_id") ?? event.aggregateId;
    const at = isoFromMs(event.eventTime);
    await manager.query(
        `insert into tasks_current (
            id, title, slug, workspace_path, status, task_kind, created_at, updated_at,
            last_session_started_at, cli_source
         ) values (?, ?, ?, ?, ?, ?, ?, ?, null, ?)
         on conflict(id) do update set
            title = excluded.title,
            slug = excluded.slug,
            workspace_path = excluded.workspace_path,
            task_kind = excluded.task_kind,
            updated_at = excluded.updated_at,
            cli_source = coalesce(excluded.cli_source, tasks_current.cli_source)`,
        [
            taskId,
            getString(event.payload, "title") ?? "Untitled task",
            getString(event.payload, "slug") ?? event.aggregateId,
            getString(event.payload, "workspace_path"),
            "running",
            getString(event.payload, "kind") ?? "primary",
            at,
            at,
            getString(event.payload, "cli_source"),
        ],
    );
    await syncTaskRelations(manager, taskId, {
        parentTaskId: getString(event.payload, "parent_task_id"),
        parentSessionId: getString(event.payload, "parent_session_id"),
        backgroundTaskId: getString(event.payload, "background_task_id"),
    });
}

async function projectTaskRenamed(manager: EntityManager, event: DomainEvent): Promise<void> {
    await manager.query(
        `update tasks_current
         set title = ?, slug = coalesce(?, slug), updated_at = ?
         where id = ?`,
        [
            getString(event.payload, "to") ?? "Untitled task",
            getString(event.payload, "slug"),
            isoFromMs(event.eventTime),
            getString(event.payload, "task_id") ?? event.aggregateId,
        ],
    );
}

async function projectTaskStatusChanged(manager: EntityManager, event: DomainEvent): Promise<void> {
    await manager.query(
        `update tasks_current
         set status = ?, updated_at = ?
         where id = ?`,
        [
            getString(event.payload, "to") ?? "running",
            isoFromMs(event.eventTime),
            getString(event.payload, "task_id") ?? event.aggregateId,
        ],
    );
}

async function projectTaskHierarchyChanged(manager: EntityManager, event: DomainEvent): Promise<void> {
    const taskId = getString(event.payload, "task_id") ?? event.aggregateId;
    await manager.query(
        `update tasks_current set updated_at = ? where id = ?`,
        [isoFromMs(event.eventTime), taskId],
    );
    await syncTaskRelations(manager, taskId, {
        parentTaskId: getString(event.payload, "parent_task_id_to"),
        parentSessionId: getString(event.payload, "parent_session_id_to"),
        backgroundTaskId: getString(event.payload, "background_task_id_to"),
    });
}

async function syncTaskRelations(
    manager: EntityManager,
    taskId: string,
    relations: {
        readonly parentTaskId?: string | null;
        readonly parentSessionId?: string | null;
        readonly backgroundTaskId?: string | null;
    },
): Promise<void> {
    await syncTaskRelation(manager, taskId, "parent", relations.parentTaskId ?? null, null);
    await syncTaskRelation(manager, taskId, "spawned_by_session", null, relations.parentSessionId ?? null);
    await syncTaskRelation(manager, taskId, "background", relations.backgroundTaskId ?? null, null);
}

async function syncTaskRelation(
    manager: EntityManager,
    taskId: string,
    relationKind: "parent" | "background" | "spawned_by_session",
    relatedTaskId: string | null,
    sessionId: string | null,
): Promise<void> {
    await manager.query(
        `delete from task_relations
         where task_id = ? and relation_kind = ?`,
        [taskId, relationKind],
    );

    if (!relatedTaskId && !sessionId) {
        return;
    }

    await manager.query(
        `insert into task_relations (task_id, related_task_id, relation_kind, session_id)
         values (?, ?, ?, ?)`,
        [taskId, relatedTaskId, relationKind, sessionId],
    );
}
