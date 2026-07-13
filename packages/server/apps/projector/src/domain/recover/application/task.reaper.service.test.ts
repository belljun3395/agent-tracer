import { describe, expect, it } from "vitest";
import { TaskEntity } from "@monitor/tracer-domain";
import type { NotificationEnvelope } from "@monitor/kernel";
import { TaskReaperService } from "./task.reaper.service.js";
import type { NotificationPublisherPort } from "~projector/domain/recover/port/notification.publisher.port.js";
import { InMemoryAdvisoryLock } from "~projector/domain/recover/port/__fakes__/in-memory.advisory.lock.js";
import { InMemoryTaskReaperRepository } from "~projector/domain/recover/port/__fakes__/in-memory.task.reaper.repository.js";

const IDLE = 180_000;
const NOW = new Date("2026-01-01T01:00:00.000Z");

function staleChild(id: string): TaskEntity {
    const task = new TaskEntity();
    task.id = id;
    task.userId = "u";
    task.parentTaskId = "P";
    task.status = "running";
    task.createdAt = new Date("2026-01-01T00:00:00.000Z");
    task.updatedAt = new Date("2026-01-01T00:00:00.000Z");
    task.lastEventAt = new Date("2026-01-01T00:30:00.000Z");
    task.title = "sub";
    task.slug = "sub";
    task.taskKind = "background";
    task.origin = "user";
    return task;
}

interface Harness {
    readonly reaper: TaskReaperService;
    readonly published: NotificationEnvelope[];
    readonly tasks: InMemoryTaskReaperRepository;
}

function makeHarness(opts: {
    candidates: TaskEntity[];
    lockAcquired?: boolean;
}): Harness {
    const published: NotificationEnvelope[] = [];
    const tasks = new InMemoryTaskReaperRepository();
    tasks.seed(...opts.candidates);
    const lock = new InMemoryAdvisoryLock({ tasks }, opts.lockAcquired ?? true);
    const publisher: NotificationPublisherPort = {
        publish: async (envelope) => {
            published.push(envelope);
        },
    };
    const reaper = new TaskReaperService(lock, publisher);
    return { reaper, published, tasks };
}

describe("TaskReaperService", () => {
    it("idle 자식을 completed로 회수하고 taskUpdated 알림을 낸다", async () => {
        const child = staleChild("c1");
        const h = makeHarness({ candidates: [child] });
        const count = await h.reaper.runOnce(NOW, IDLE);
        expect(count).toBe(1);
        expect(child.status).toBe("completed");
        expect(h.tasks.upserted).toEqual(["c1"]);
        expect(h.published).toHaveLength(1);
        expect(h.published[0]?.notification.type).toBe("task.updated");
    });

    it("락을 못 잡으면 아무것도 회수하지 않고 알림도 없다", async () => {
        const h = makeHarness({ candidates: [staleChild("c1")], lockAcquired: false });
        const count = await h.reaper.runOnce(NOW, IDLE);
        expect(count).toBe(0);
        expect(h.tasks.upserted).toEqual([]);
        expect(h.published).toEqual([]);
    });

    it("회수 대상이 없으면 알림을 내지 않는다", async () => {
        const h = makeHarness({ candidates: [] });
        const count = await h.reaper.runOnce(NOW, IDLE);
        expect(count).toBe(0);
        expect(h.published).toEqual([]);
    });
});
