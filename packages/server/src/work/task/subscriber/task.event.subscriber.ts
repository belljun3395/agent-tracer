import { Inject, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import {
    DataSource,
    EventSubscriber,
    type EntitySubscriberInterface,
    type InsertEvent,
    type Repository,
    type UpdateEvent,
} from "typeorm";
import { TaskEntity } from "../domain/task.entity.js";
import { TaskRelationEntity } from "../domain/task.relation.entity.js";
import { CLOCK_PORT, ID_GENERATOR_PORT } from "../application/outbound/tokens.js";
import type { IClock } from "../application/outbound/clock.port.js";
import type { IIdGenerator } from "../application/outbound/id.generator.port.js";
import { TaskEventLogEntity } from "./event.log.entity.js";

interface DomainEventDraft {
    readonly eventType: string;
    readonly eventTime: number;
    readonly aggregateId: string;
    readonly payload: Record<string, unknown>;
}

/**
 * Subscribes to TaskEntity lifecycle and writes the corresponding domain
 * events (task.created / task.renamed / task.status_changed) to the shared
 * events log.
 */
@Injectable()
@EventSubscriber()
export class TaskEntitySubscriber implements EntitySubscriberInterface<TaskEntity> {
    constructor(
        @InjectDataSource() dataSource: DataSource,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
        @Inject(ID_GENERATOR_PORT) private readonly idGen: IIdGenerator,
    ) {
        dataSource.subscribers.push(this);
    }

    listenTo() {
        return TaskEntity;
    }

    async afterInsert(event: InsertEvent<TaskEntity>): Promise<void> {
        const task = event.entity;
        const repo = event.manager.getRepository(TaskEventLogEntity);
        await this.appendEvent(repo, {
            eventType: "task.created",
            eventTime: this.eventTimeFromIso(task.createdAt),
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
        const eventTime = this.eventTimeFromIso(after.updatedAt);

        if (before.title !== after.title) {
            await this.appendEvent(repo, {
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
            await this.appendEvent(repo, {
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

    private eventTimeFromIso(value: string | undefined): number {
        if (!value) return this.clock.nowMs();
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : this.clock.nowMs();
    }

    private async appendEvent(
        repo: Repository<TaskEventLogEntity>,
        draft: DomainEventDraft,
    ): Promise<void> {
        await repo.insert({
            eventId: this.idGen.newUlid(draft.eventTime),
            eventTime: draft.eventTime,
            eventType: draft.eventType,
            schemaVer: 1,
            aggregateId: draft.aggregateId,
            sessionId: null,
            actor: "system",
            correlationId: null,
            causationId: null,
            payloadJson: JSON.stringify(draft.payload),
            recordedAt: this.clock.nowMs(),
        });
    }
}

/**
 * Subscribes to TaskRelationEntity lifecycle and emits task.hierarchy_changed
 * when a parent or background relation is created or modified.
 */
@Injectable()
@EventSubscriber()
export class TaskRelationEntitySubscriber implements EntitySubscriberInterface<TaskRelationEntity> {
    constructor(
        @InjectDataSource() dataSource: DataSource,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
        @Inject(ID_GENERATOR_PORT) private readonly idGen: IIdGenerator,
    ) {
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
        const eventTime = this.clock.nowMs();
        await repo.insert({
            eventId: this.idGen.newUlid(eventTime),
            eventTime,
            eventType: "task.hierarchy_changed",
            schemaVer: 1,
            aggregateId: relation.taskId,
            sessionId: null,
            actor: "system",
            correlationId: null,
            causationId: null,
            payloadJson: JSON.stringify(payload),
            recordedAt: eventTime,
        });
    }

    async afterUpdate(event: UpdateEvent<TaskRelationEntity>): Promise<void> {
        const before = event.databaseEntity;
        const after = event.entity as TaskRelationEntity | undefined;
        if (!after) return;
        const repo = event.manager.getRepository(TaskEventLogEntity);
        const payload = relationToPayload(after, before);
        if (!payload) return;
        const eventTime = this.clock.nowMs();
        await repo.insert({
            eventId: this.idGen.newUlid(eventTime),
            eventTime,
            eventType: "task.hierarchy_changed",
            schemaVer: 1,
            aggregateId: after.taskId,
            sessionId: null,
            actor: "system",
            correlationId: null,
            causationId: null,
            payloadJson: JSON.stringify(payload),
            recordedAt: eventTime,
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
