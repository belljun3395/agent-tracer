import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { DataSource } from "typeorm";
import { TaskEntity } from "../domain/task.entity.js";
import { TaskRelationEntity } from "../domain/task.relation.entity.js";
import { TaskEventLogEntity } from "./event.log.entity.js";
import {
    TaskEntitySubscriber,
    TaskRelationEntitySubscriber,
} from "./task.event.subscriber.js";
import type { IClock } from "../application/outbound/clock.port.js";
import type { IIdGenerator } from "../application/outbound/id.generator.port.js";

const FROZEN_MS = 1_777_000_000_000;
const FROZEN_ISO = new Date(FROZEN_MS).toISOString();

function makeClock(): IClock & { nowMs: Mock; nowIso: Mock } {
    return {
        nowMs: vi.fn(() => FROZEN_MS),
        nowIso: vi.fn(() => FROZEN_ISO),
    };
}

function makeIdGen(): IIdGenerator & { newUuid: Mock; newUlid: Mock } {
    let counter = 0;
    return {
        newUuid: vi.fn(() => "uuid-stub"),
        newUlid: vi.fn((timeMs?: number) => {
            counter += 1;
            return `01TESTULID${String(counter).padStart(2, "0")}${(timeMs ?? FROZEN_MS).toString(16).padStart(14, "0").slice(0, 14).toUpperCase()}`.slice(0, 26);
        }),
    };
}

describe("TaskEntitySubscriber (in-memory DataSource)", () => {
    let ds: DataSource;
    let clock: ReturnType<typeof makeClock>;
    let idGen: ReturnType<typeof makeIdGen>;

    beforeEach(async () => {
        ds = new DataSource({
            type: "better-sqlite3",
            database: ":memory:",
            entities: [TaskEntity, TaskRelationEntity, TaskEventLogEntity],
            synchronize: true,
        });
        await ds.initialize();
        clock = makeClock();
        idGen = makeIdGen();
        // Subscribers register themselves in their constructor.
        new TaskEntitySubscriber(ds, clock, idGen);
        new TaskRelationEntitySubscriber(ds, clock, idGen);
    });

    afterEach(async () => {
        await ds.destroy();
    });

    function makeTask(overrides: Partial<TaskEntity> = {}): TaskEntity {
        const e = new TaskEntity();
        e.id = "t-1";
        e.title = "First";
        e.slug = "first";
        e.workspacePath = null;
        e.status = "running";
        e.taskKind = "primary";
        e.createdAt = "2026-04-29T10:00:00.000Z";
        e.updatedAt = "2026-04-29T10:00:00.000Z";
        e.lastSessionStartedAt = null;
        e.cliSource = null;
        Object.assign(e, overrides);
        return e;
    }

    it("on TaskEntity insert — appends a 'task.created' row using injected Clock + IIdGenerator", async () => {
        const repo = ds.getRepository(TaskEntity);
        const eventsRepo = ds.getRepository(TaskEventLogEntity);

        await repo.save(makeTask());

        const events = await eventsRepo.find();
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            eventType: "task.created",
            aggregateId: "t-1",
            actor: "system",
        });
        // Recorded with our clock, not Date.now()
        expect(events[0]!.recordedAt).toBe(FROZEN_MS);
        // event_time parsed from createdAt
        expect(events[0]!.eventTime).toBe(Date.parse("2026-04-29T10:00:00.000Z"));
        expect(idGen.newUlid).toHaveBeenCalledWith(events[0]!.eventTime);

        const payload = JSON.parse(events[0]!.payloadJson) as Record<string, unknown>;
        expect(payload).toMatchObject({ task_id: "t-1", title: "First", slug: "first", kind: "primary" });
    });

    it("on TaskEntity title change — appends 'task.renamed' with from/to payload", async () => {
        const repo = ds.getRepository(TaskEntity);
        const eventsRepo = ds.getRepository(TaskEventLogEntity);
        const t = await repo.save(makeTask());
        idGen.newUlid.mockClear();

        t.title = "Renamed";
        t.updatedAt = "2026-04-29T11:00:00.000Z";
        await repo.save(t);

        const events = await eventsRepo.find({ where: { eventType: "task.renamed" } });
        expect(events).toHaveLength(1);
        const payload = JSON.parse(events[0]!.payloadJson) as Record<string, unknown>;
        expect(payload).toMatchObject({ task_id: "t-1", from: "First", to: "Renamed" });
        expect(events[0]!.eventTime).toBe(Date.parse("2026-04-29T11:00:00.000Z"));
        expect(events[0]!.recordedAt).toBe(FROZEN_MS);
    });

    it("on TaskEntity status change — appends 'task.status_changed' with from/to payload", async () => {
        const repo = ds.getRepository(TaskEntity);
        const eventsRepo = ds.getRepository(TaskEventLogEntity);
        const t = await repo.save(makeTask());

        t.status = "completed";
        t.updatedAt = "2026-04-29T12:00:00.000Z";
        await repo.save(t);

        const events = await eventsRepo.find({ where: { eventType: "task.status_changed" } });
        expect(events).toHaveLength(1);
        const payload = JSON.parse(events[0]!.payloadJson) as Record<string, unknown>;
        expect(payload).toMatchObject({ task_id: "t-1", from: "running", to: "completed" });
    });

    it("uses Clock.nowMs() as fallback when entity.createdAt is missing/invalid", async () => {
        const repo = ds.getRepository(TaskEntity);
        const eventsRepo = ds.getRepository(TaskEventLogEntity);
        // synchronize=true creates the column NOT NULL — but we can simulate via direct insert with empty string
        const t = makeTask({ createdAt: "not-a-date" });
        await repo.save(t);

        const events = await eventsRepo.find();
        expect(events[0]!.eventTime).toBe(FROZEN_MS);
    });

    it("on TaskRelationEntity insert with parent — appends 'task.hierarchy_changed' using the clock", async () => {
        const taskRepo = ds.getRepository(TaskEntity);
        const relRepo = ds.getRepository(TaskRelationEntity);
        const eventsRepo = ds.getRepository(TaskEventLogEntity);
        // create the parent and child first so the FK references resolve
        await taskRepo.save(makeTask({ id: "parent" }));
        await taskRepo.save(makeTask({ id: "child" }));

        const rel = new TaskRelationEntity();
        rel.taskId = "child";
        rel.relationKind = "parent";
        rel.relatedTaskId = "parent";
        rel.sessionId = null;
        await relRepo.save(rel);

        const events = await eventsRepo.find({ where: { eventType: "task.hierarchy_changed" } });
        expect(events).toHaveLength(1);
        expect(events[0]!.eventTime).toBe(FROZEN_MS);
        expect(events[0]!.recordedAt).toBe(FROZEN_MS);
    });
});
