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

/**
 * Domain model — encapsulates the rules for projecting raw TaskRelationEntity
 * rows into a snapshot, and for translating snapshot edits into the (kind,
 * targetField) entity tuples that need to be persisted.
 *
 * Repositories return raw entity arrays; this model owns the meaning of each
 * relation_kind value (parent / spawned_by_session / background) and which
 * column carries the related id.
 */
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

    /**
     * Group rows by task id and produce one TaskRelations per id. `taskIds`
     * provides the seed set so callers receive an entry for every requested
     * id, even when a task has no relations.
     */
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

    /**
     * Translate a snapshot edit into the (kind, related_task_id, session_id)
     * tuples that need to be upserted. Each entry can be passed to a
     * repository's syncRelation(kind, relatedId, sessionId) for that taskId.
     */
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
