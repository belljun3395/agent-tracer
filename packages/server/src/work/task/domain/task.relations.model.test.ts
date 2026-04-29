import { describe, expect, it } from "vitest";
import { TaskRelations } from "./task.relations.model.js";
import type { TaskRelationEntity } from "./task.relation.entity.js";

function entity(partial: Partial<TaskRelationEntity> & Pick<TaskRelationEntity, "taskId" | "relationKind">): TaskRelationEntity {
    return {
        relatedTaskId: null,
        sessionId: null,
        ...partial,
    } as TaskRelationEntity;
}

describe("TaskRelations.empty", () => {
    it("returns a snapshot with all-null fields", () => {
        const snap = TaskRelations.empty().asSnapshot();
        expect(snap).toEqual({
            parentTaskId: null,
            parentSessionId: null,
            backgroundTaskId: null,
        });
    });
});

describe("TaskRelations.fromEntities", () => {
    it("projects parent rows into parentTaskId", () => {
        const relations = TaskRelations.fromEntities([
            entity({ taskId: "t-1", relationKind: "parent", relatedTaskId: "p-1" }),
        ]);

        expect(relations.asSnapshot().parentTaskId).toBe("p-1");
    });

    it("projects spawned_by_session rows into parentSessionId (using sessionId column)", () => {
        const relations = TaskRelations.fromEntities([
            entity({ taskId: "t-1", relationKind: "spawned_by_session", sessionId: "s-1" }),
        ]);

        expect(relations.asSnapshot().parentSessionId).toBe("s-1");
        expect(relations.asSnapshot().parentTaskId).toBeNull();
    });

    it("projects background rows into backgroundTaskId", () => {
        const relations = TaskRelations.fromEntities([
            entity({ taskId: "t-1", relationKind: "background", relatedTaskId: "bg-1" }),
        ]);

        expect(relations.asSnapshot().backgroundTaskId).toBe("bg-1");
    });

    it("merges multiple kinds in a single snapshot", () => {
        const relations = TaskRelations.fromEntities([
            entity({ taskId: "t-1", relationKind: "parent", relatedTaskId: "p-1" }),
            entity({ taskId: "t-1", relationKind: "background", relatedTaskId: "bg-1" }),
            entity({ taskId: "t-1", relationKind: "spawned_by_session", sessionId: "s-1" }),
        ]);

        expect(relations.asSnapshot()).toEqual({
            parentTaskId: "p-1",
            parentSessionId: "s-1",
            backgroundTaskId: "bg-1",
        });
    });

    it("later rows of the same kind overwrite earlier ones", () => {
        const relations = TaskRelations.fromEntities([
            entity({ taskId: "t-1", relationKind: "parent", relatedTaskId: "p-1" }),
            entity({ taskId: "t-1", relationKind: "parent", relatedTaskId: "p-2" }),
        ]);

        expect(relations.asSnapshot().parentTaskId).toBe("p-2");
    });
});

describe("TaskRelations.toSyncTuples", () => {
    it("emits a parent tuple when parentTaskId is provided (including null for clearing)", () => {
        expect(TaskRelations.toSyncTuples({ parentTaskId: "p-1" })).toEqual([
            { kind: "parent", relatedTaskId: "p-1", sessionId: null },
        ]);
        expect(TaskRelations.toSyncTuples({ parentTaskId: null })).toEqual([
            { kind: "parent", relatedTaskId: null, sessionId: null },
        ]);
    });

    it("emits a spawned_by_session tuple with sessionId, leaving relatedTaskId null", () => {
        expect(TaskRelations.toSyncTuples({ parentSessionId: "s-1" })).toEqual([
            { kind: "spawned_by_session", relatedTaskId: null, sessionId: "s-1" },
        ]);
    });

    it("emits a background tuple with relatedTaskId set", () => {
        expect(TaskRelations.toSyncTuples({ backgroundTaskId: "bg-1" })).toEqual([
            { kind: "background", relatedTaskId: "bg-1", sessionId: null },
        ]);
    });

    it("emits multiple tuples together when several fields are set", () => {
        const tuples = TaskRelations.toSyncTuples({
            parentTaskId: "p-1",
            parentSessionId: "s-1",
            backgroundTaskId: "bg-1",
        });

        expect(tuples).toEqual([
            { kind: "parent", relatedTaskId: "p-1", sessionId: null },
            { kind: "spawned_by_session", relatedTaskId: null, sessionId: "s-1" },
            { kind: "background", relatedTaskId: "bg-1", sessionId: null },
        ]);
    });

    it("emits no tuples when input is empty (undefined fields are ignored, not cleared)", () => {
        expect(TaskRelations.toSyncTuples({})).toEqual([]);
    });
});

describe("TaskRelations.groupByTaskId", () => {
    it("returns one TaskRelations per requested id, even when an id has no rows", () => {
        const grouped = TaskRelations.groupByTaskId(
            ["t-1", "t-2", "t-3"],
            [entity({ taskId: "t-1", relationKind: "parent", relatedTaskId: "p-1" })],
        );

        expect(grouped.size).toBe(3);
        expect(grouped.get("t-1")?.asSnapshot().parentTaskId).toBe("p-1");
        expect(grouped.get("t-2")?.asSnapshot()).toEqual({
            parentTaskId: null,
            parentSessionId: null,
            backgroundTaskId: null,
        });
        expect(grouped.get("t-3")?.asSnapshot()).toEqual({
            parentTaskId: null,
            parentSessionId: null,
            backgroundTaskId: null,
        });
    });

    it("ignores entities whose taskId is not in the seed list", () => {
        const grouped = TaskRelations.groupByTaskId(
            ["t-1"],
            [
                entity({ taskId: "t-1", relationKind: "parent", relatedTaskId: "p-1" }),
                entity({ taskId: "t-stranger", relationKind: "parent", relatedTaskId: "p-2" }),
            ],
        );

        expect(grouped.size).toBe(1);
        expect(grouped.get("t-1")?.asSnapshot().parentTaskId).toBe("p-1");
    });
});
