import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import {
    DataSource,
    EventSubscriber,
    type EntitySubscriberInterface,
    type InsertEvent,
    type Repository,
    type UpdateEvent,
} from "typeorm";
import { generateUlid } from "~adapters/persistence/sqlite/events/ulid.js";
import { TaskEntity } from "../domain/task.entity.js";
import { TaskRelationEntity } from "../domain/task.relation.entity.js";
import { TaskEventLogEntity } from "./event.log.entity.js";

interface DomainEventDraft {
    readonly eventType: string;
    readonly eventTime: number;
    readonly aggregateId: string;
    readonly payload: Record<string, unknown>;
}

function eventTimeFromIso(value: string | undefined, fallback = Date.now()): number {
    if (!value) return fallback;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

async function appendEvent(
    repo: Repository<TaskEventLogEntity>,
    draft: DomainEventDraft,
): Promise<void> {
    await repo.insert({
        eventId: generateUlid(draft.eventTime),
        eventTime: draft.eventTime,
        eventType: draft.eventType,
        schemaVer: 1,
        aggregateId: draft.aggregateId,
        sessionId: null,
        actor: "system",
        correlationId: null,
        causationId: null,
        payloadJson: JSON.stringify(draft.payload),
        recordedAt: Date.now(),
    });
}

/**
 * Subscribes to TaskEntity lifecycle and writes the corresponding domain
 * events (task.created / task.renamed / task.status_changed) to the shared
 * events log.
 *
 * TaskEntity is the source of truth for tasks; the events log is the
 * append-only audit trail kept consistent by this subscriber.
 */
@Injectable()
@EventSubscriber()
export class TaskEntitySubscriber implements EntitySubscriberInterface<TaskEntity> {
    constructor(@InjectDataSource() dataSource: DataSource) {
        dataSource.subscribers.push(this);
    }

    listenTo() {
        return TaskEntity;
    }

    async afterInsert(event: InsertEvent<TaskEntity>): Promise<void> {
        const task = event.entity;
        const repo = event.manager.getRepository(TaskEventLogEntity);
        await appendEvent(repo, {
            eventType: "task.created",
            eventTime: eventTimeFromIso(task.createdAt),
            aggregateId: task.id,
            payload: {
                task_id: task.id,
                title: task.title,
                slug: task.slug,
                kind: task.taskKind,
                ...(task.workspacePath ? { workspace_path: task.workspacePath } : {}),
                ...(task.cliSource ? { cli_source: task.cliSource } : {}),
            },
        });
    }

    async afterUpdate(event: UpdateEvent<TaskEntity>): Promise<void> {
        const before = event.databaseEntity;
        const after = event.entity as TaskEntity | undefined;
        if (!after) return;
        const repo = event.manager.getRepository(TaskEventLogEntity);
        const eventTime = eventTimeFromIso(after.updatedAt);

        if (before.title !== after.title) {
            await appendEvent(repo, {
                eventType: "task.renamed",
                eventTime,
                aggregateId: after.id,
                payload: {
                    task_id: after.id,
                    from: before.title,
                    to: after.title,
                },
            });
        }

        if (before.status !== after.status) {
            await appendEvent(repo, {
                eventType: "task.status_changed",
                eventTime,
                aggregateId: after.id,
                payload: {
                    task_id: after.id,
                    from: before.status,
                    to: after.status,
                },
            });
        }
    }
}

/**
 * Subscribes to TaskRelationEntity lifecycle and emits task.hierarchy_changed
 * when a parent or background relation is created or modified.
 */
@Injectable()
@EventSubscriber()
export class TaskRelationEntitySubscriber implements EntitySubscriberInterface<TaskRelationEntity> {
    constructor(@InjectDataSource() dataSource: DataSource) {
        dataSource.subscribers.push(this);
    }

    listenTo() {
        return TaskRelationEntity;
    }

    async afterInsert(event: InsertEvent<TaskRelationEntity>): Promise<void> {
        const relation = event.entity;
        const repo = event.manager.getRepository(TaskEventLogEntity);
        const payload = relationToPayload(relation, undefined);
        if (!payload) return;
        await appendEvent(repo, {
            eventType: "task.hierarchy_changed",
            eventTime: Date.now(),
            aggregateId: relation.taskId,
            payload,
        });
    }

    async afterUpdate(event: UpdateEvent<TaskRelationEntity>): Promise<void> {
        const before = event.databaseEntity;
        const after = event.entity as TaskRelationEntity | undefined;
        if (!after) return;
        const repo = event.manager.getRepository(TaskEventLogEntity);
        const payload = relationToPayload(after, before);
        if (!payload) return;
        await appendEvent(repo, {
            eventType: "task.hierarchy_changed",
            eventTime: Date.now(),
            aggregateId: after.taskId,
            payload,
        });
    }
}

function relationToPayload(
    after: TaskRelationEntity,
    before: TaskRelationEntity | undefined,
): Record<string, unknown> | null {
    const payload: Record<string, unknown> = { task_id: after.taskId };
    let changed = false;

    if (after.relationKind === "parent") {
        const fromValue = before?.relatedTaskId ?? null;
        const toValue = after.relatedTaskId ?? null;
        if (fromValue !== toValue) {
            if (fromValue) payload["parent_task_id_from"] = fromValue;
            if (toValue) payload["parent_task_id_to"] = toValue;
            changed = true;
        }
    } else if (after.relationKind === "background") {
        const fromValue = before?.relatedTaskId ?? null;
        const toValue = after.relatedTaskId ?? null;
        if (fromValue !== toValue) {
            if (fromValue) payload["background_task_id_from"] = fromValue;
            if (toValue) payload["background_task_id_to"] = toValue;
            changed = true;
        }
    } else {
        // spawned_by_session
        const fromValue = before?.sessionId ?? null;
        const toValue = after.sessionId ?? null;
        if (fromValue !== toValue) {
            if (fromValue) payload["parent_session_id_from"] = fromValue;
            if (toValue) payload["parent_session_id_to"] = toValue;
            changed = true;
        }
    }

    return changed ? payload : null;
}
