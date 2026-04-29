import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { TaskManagementService } from "./task.management.service.js";
import type { TaskQueryService } from "./task.query.service.js";
import type { TaskRepository } from "../repository/task.repository.js";
import type { TaskRelationRepository } from "../repository/task.relation.repository.js";
import type { IClock } from "../application/outbound/clock.port.js";
import type {
    ITaskNotificationPublisher,
    TaskOutboundNotification,
} from "../application/outbound/notification.publisher.port.js";
import type { TaskEntity } from "../domain/task.entity.js";
import type { MonitoringTask } from "../domain/task.model.js";
import { TaskNotFoundError } from "../common/task.errors.js";

const FROZEN_ISO = "2026-04-29T10:00:00.000Z";
const NOW_ISO = "2026-04-29T12:00:00.000Z";

function makeClock(iso = NOW_ISO): IClock & { nowIso: Mock; nowMs: Mock } {
    return {
        nowMs: vi.fn(() => Date.parse(iso)),
        nowIso: vi.fn(() => iso),
    };
}

function entity(overrides: Partial<TaskEntity> = {}): TaskEntity {
    return {
        id: "t-1",
        title: "Title",
        slug: "title",
        status: "running",
        taskKind: "primary",
        createdAt: FROZEN_ISO,
        updatedAt: FROZEN_ISO,
        lastSessionStartedAt: FROZEN_ISO,
        workspacePath: null,
        runtimeSource: null,
        cliSource: null,
        ...overrides,
    } as TaskEntity;
}

function snapshot(overrides: Partial<MonitoringTask> = {}): MonitoringTask {
    return {
        id: "t-1",
        title: "Title",
        slug: "title",
        status: "running",
        taskKind: "primary",
        createdAt: FROZEN_ISO,
        updatedAt: FROZEN_ISO,
        ...overrides,
    };
}

interface Harness {
    service: TaskManagementService;
    taskRepo: TaskRepository & { findById: Mock; save: Mock; deleteByIds: Mock; collectDescendantIds: Mock; listIdsByStatuses: Mock };
    relationRepo: TaskRelationRepository & { syncRelation: Mock };
    query: TaskQueryService & { findById: Mock };
    notifier: { publish: Mock; calls: TaskOutboundNotification[] };
    clock: ReturnType<typeof makeClock>;
}

function setup(opts: { clock?: IClock & { nowIso: Mock; nowMs: Mock } } = {}): Harness {
    const taskRepo = {
        findById: vi.fn(),
        save: vi.fn(async (e: TaskEntity) => e),
        deleteByIds: vi.fn(async () => undefined),
        collectDescendantIds: vi.fn(async () => []),
        listIdsByStatuses: vi.fn(async () => []),
    } as unknown as TaskRepository & { findById: Mock; save: Mock; deleteByIds: Mock; collectDescendantIds: Mock; listIdsByStatuses: Mock };
    const relationRepo = {
        syncRelation: vi.fn(async () => undefined),
    } as unknown as TaskRelationRepository & { syncRelation: Mock };
    const query = {
        findById: vi.fn(),
    } as unknown as TaskQueryService & { findById: Mock };
    const calls: TaskOutboundNotification[] = [];
    const notifier = {
        publish: vi.fn((n: TaskOutboundNotification) => { calls.push(n); }),
        calls,
    };
    const clock = opts.clock ?? makeClock();

    const service = new TaskManagementService(taskRepo, relationRepo, query, notifier as unknown as ITaskNotificationPublisher, clock);
    return { service, taskRepo, relationRepo, query, notifier, clock };
}

describe("TaskManagementService.update", () => {
    it("returns null when the task does not exist (no save, no notify)", async () => {
        const h = setup();
        h.query.findById.mockResolvedValue(null);

        const result = await h.service.update({ taskId: "missing", title: "x" });

        expect(result).toBeNull();
        expect(h.taskRepo.save).not.toHaveBeenCalled();
        expect(h.notifier.publish).not.toHaveBeenCalled();
    });

    it("is a no-op when neither title nor status would actually change", async () => {
        const h = setup();
        const current = snapshot({ title: "same", status: "running" });
        h.query.findById.mockResolvedValue(current);

        const result = await h.service.update({ taskId: "t-1", title: "same", status: "running" });

        expect(result).toBe(current);
        expect(h.taskRepo.save).not.toHaveBeenCalled();
        expect(h.notifier.publish).not.toHaveBeenCalled();
        expect(h.clock.nowIso).not.toHaveBeenCalled();
    });

    it("on title change, regenerates slug, stamps updatedAt with IClock, and publishes task.updated", async () => {
        const h = setup();
        const current = snapshot({ title: "Old title", slug: "old-title" });
        const ent = entity({ title: "Old title", slug: "old-title" });
        h.query.findById
            .mockResolvedValueOnce(current)
            .mockResolvedValueOnce({ ...current, title: "Brand new!", slug: "brand-new", updatedAt: NOW_ISO });
        h.taskRepo.findById.mockResolvedValue(ent);

        await h.service.update({ taskId: "t-1", title: "Brand new!" });

        expect(h.clock.nowIso).toHaveBeenCalledTimes(1);
        const savedEntity = h.taskRepo.save.mock.calls[0]![0] as TaskEntity;
        expect(savedEntity.title).toBe("Brand new!");
        expect(savedEntity.slug).toBe("brand-new");
        expect(savedEntity.updatedAt).toBe(NOW_ISO);
        expect(h.notifier.calls.map((c) => c.type)).toEqual(["task.updated"]);
    });

    it("status-only change still stamps updatedAt with IClock", async () => {
        const h = setup();
        const current = snapshot({ status: "running" });
        h.query.findById
            .mockResolvedValueOnce(current)
            .mockResolvedValueOnce({ ...current, status: "completed", updatedAt: NOW_ISO });
        h.taskRepo.findById.mockResolvedValue(entity({ status: "running" }));

        await h.service.update({ taskId: "t-1", status: "completed" });

        const savedEntity = h.taskRepo.save.mock.calls[0]![0] as TaskEntity;
        expect(savedEntity.status).toBe("completed");
        expect(savedEntity.updatedAt).toBe(NOW_ISO);
    });
});

describe("TaskManagementService.link", () => {
    it("throws TaskNotFoundError when entity is missing", async () => {
        const h = setup();
        h.taskRepo.findById.mockResolvedValue(null);

        await expect(h.service.link({ taskId: "missing" })).rejects.toBeInstanceOf(TaskNotFoundError);
        expect(h.clock.nowIso).not.toHaveBeenCalled();
    });

    it("updates title/taskKind/relations + stamps updatedAt with IClock + publishes task.updated", async () => {
        const h = setup();
        const ent = entity();
        h.taskRepo.findById.mockResolvedValue(ent);
        h.query.findById.mockResolvedValue(snapshot({ title: "Linked!", updatedAt: NOW_ISO }));

        await h.service.link({
            taskId: "t-1",
            title: "Linked!",
            taskKind: "background",
            parentTaskId: "p-1",
            backgroundTaskId: "bg-1",
        });

        expect(ent.title).toBe("Linked!");
        expect(ent.taskKind).toBe("background");
        expect(ent.updatedAt).toBe(NOW_ISO);
        expect(h.relationRepo.syncRelation).toHaveBeenCalledTimes(2);
        expect(h.notifier.calls.map((c) => c.type)).toEqual(["task.updated"]);
    });
});

describe("TaskManagementService.delete", () => {
    it("returns not_found when task is absent (no notifications)", async () => {
        const h = setup();
        h.taskRepo.findById.mockResolvedValue(null);

        const result = await h.service.delete("missing");

        expect(result).toEqual({ status: "not_found" });
        expect(h.notifier.publish).not.toHaveBeenCalled();
    });

    it("deletes the task and its descendants, publishing task.deleted for each id", async () => {
        const h = setup();
        h.taskRepo.findById.mockResolvedValue(entity());
        h.taskRepo.collectDescendantIds.mockResolvedValue(["t-2", "t-3"]);

        const result = await h.service.delete("t-1");

        expect(h.taskRepo.deleteByIds).toHaveBeenCalledWith(["t-1", "t-2", "t-3"]);
        expect(result).toEqual({ status: "deleted", deletedIds: ["t-1", "t-2", "t-3"] });
        expect(h.notifier.calls.map((c) => c.type)).toEqual([
            "task.deleted",
            "task.deleted",
            "task.deleted",
        ]);
    });
});

describe("TaskManagementService.deleteFinished", () => {
    it("short-circuits when no finished tasks exist (count=0, no notification)", async () => {
        const h = setup();
        h.taskRepo.listIdsByStatuses.mockResolvedValue([]);

        const result = await h.service.deleteFinished();

        expect(result).toEqual({ count: 0 });
        expect(h.taskRepo.deleteByIds).not.toHaveBeenCalled();
        expect(h.notifier.publish).not.toHaveBeenCalled();
    });

    it("aggregates descendants and publishes a single tasks.purged notification", async () => {
        const h = setup();
        h.taskRepo.listIdsByStatuses.mockResolvedValue(["t-1", "t-2"]);
        h.taskRepo.collectDescendantIds
            .mockResolvedValueOnce(["t-1a"])
            .mockResolvedValueOnce(["t-2a", "t-2b"]);

        const result = await h.service.deleteFinished();

        expect(result.count).toBe(5);
        expect(h.notifier.calls).toEqual([
            { type: "tasks.purged", payload: { count: 5 } },
        ]);
    });
});
