import type { TaskRelationEntity, TaskRelationKind } from "./task.relation.entity.js";

export interface TaskRelationsSnapshot {
    readonly parentTaskId: string | null;
    readonly parentSessionId: string | null;
    readonly backgroundTaskId: string | null;
}

export interface TaskRelationsAssignInput {
    readonly parentTaskId?: string | null;
    readonly parentSessionId?: string | null;
    readonly backgroundTaskId?: string | null;
}

const EMPTY_SNAPSHOT: TaskRelationsSnapshot = {
    parentTaskId: null,
    parentSessionId: null,
    backgroundTaskId: null,
};

export class TaskRelations {
    private constructor(private readonly snapshot: TaskRelationsSnapshot) {}

    static empty(): TaskRelations {
        return new TaskRelations(EMPTY_SNAPSHOT);
    }

    static fromEntities(entities: readonly TaskRelationEntity[]): TaskRelations {
        let snapshot: TaskRelationsSnapshot = EMPTY_SNAPSHOT;
        for (const entity of entities) {
            snapshot = applyEntity(snapshot, entity);
        }
        return new TaskRelations(snapshot);
    }

    static groupByTaskId(
        taskIds: readonly string[],
        entities: readonly TaskRelationEntity[],
    ): Map<string, TaskRelations> {
        const buckets = new Map<string, TaskRelationEntity[]>();
        for (const id of taskIds) buckets.set(id, []);
        for (const entity of entities) {
            const bucket = buckets.get(entity.taskId);
            if (bucket) bucket.push(entity);
        }
        const result = new Map<string, TaskRelations>();
        for (const [id, rows] of buckets) {
            result.set(id, TaskRelations.fromEntities(rows));
        }
        return result;
    }

    asSnapshot(): TaskRelationsSnapshot {
        return this.snapshot;
    }

    static toSyncTuples(
        input: TaskRelationsAssignInput,
    ): readonly { readonly kind: TaskRelationKind; readonly relatedTaskId: string | null; readonly sessionId: string | null }[] {
        const tuples: { kind: TaskRelationKind; relatedTaskId: string | null; sessionId: string | null }[] = [];
        if (input.parentTaskId !== undefined) {
            tuples.push({ kind: "parent", relatedTaskId: input.parentTaskId, sessionId: null });
        }
        if (input.parentSessionId !== undefined) {
            tuples.push({ kind: "spawned_by_session", relatedTaskId: null, sessionId: input.parentSessionId });
        }
        if (input.backgroundTaskId !== undefined) {
            tuples.push({ kind: "background", relatedTaskId: input.backgroundTaskId, sessionId: null });
        }
        return tuples;
    }
}

function applyEntity(
    snapshot: TaskRelationsSnapshot,
    entity: TaskRelationEntity,
): TaskRelationsSnapshot {
    if (entity.relationKind === "parent") {
        return { ...snapshot, parentTaskId: entity.relatedTaskId };
    }
    if (entity.relationKind === "spawned_by_session") {
        return { ...snapshot, parentSessionId: entity.sessionId };
    }
    return { ...snapshot, backgroundTaskId: entity.relatedTaskId };
}
