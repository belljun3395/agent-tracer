import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Repository, EntityManager } from "typeorm";
import { EventStoreService } from "./event.store.service.js";
import type { EventLogEntity } from "~activity/event/domain/event-store/event.log.entity.js";
import type { ContentBlobEntity } from "~activity/event/domain/event-store/content.blob.entity.js";
import type { IClock } from "~activity/event/application/outbound/clock.port.js";
import type { IIdGenerator } from "~activity/event/application/outbound/id.generator.port.js";

vi.mock("./read.model.projector.js", () => ({
    projectDomainEvent: vi.fn(async () => undefined),
}));

const FROZEN_MS = 1_777_000_000_000;

interface Harness {
    service: EventStoreService;
    eventsRepo: Repository<EventLogEntity> & { insert: Mock };
    blobsRepo: Repository<ContentBlobEntity>;
    clock: IClock & { nowMs: Mock; nowIso: Mock };
    idGen: IIdGenerator & { newUlid: Mock; newUuid: Mock };
}

function setup(): Harness {
    const fakeManager = {} as EntityManager;
    const eventsRepo = {
        insert: vi.fn(async () => undefined),
        manager: fakeManager,
    } as unknown as Repository<EventLogEntity> & { insert: Mock };
    const blobsRepo = {} as unknown as Repository<ContentBlobEntity>;
    const clock: IClock & { nowMs: Mock; nowIso: Mock } = {
        nowMs: vi.fn(() => FROZEN_MS),
        nowIso: vi.fn(() => new Date(FROZEN_MS).toISOString()),
    };
    const idGen: IIdGenerator & { newUlid: Mock; newUuid: Mock } = {
        newUuid: vi.fn(() => "uuid-stub"),
        newUlid: vi.fn((timeMs?: number) => `ULID-${timeMs ?? "now"}`),
    };
    const service = new EventStoreService(eventsRepo, blobsRepo, clock, idGen);
    return { service, eventsRepo, blobsRepo, clock, idGen };
}

describe("EventStoreService.append", () => {
    it("uses idGen.newUlid(eventTime) when no eventId is provided in the draft", async () => {
        const h = setup();

        const result = await h.service.append({
            eventType: "task.created",
            eventTime: 1_700_000_000_000,
            schemaVer: 1,
            aggregateId: "t-1",
            actor: "system",
            payload: {
                task_id: "t-1",
                title: "first",
                slug: "first",
                kind: "primary",
            },
        });

        expect(h.idGen.newUlid).toHaveBeenCalledWith(1_700_000_000_000);
        expect(result.eventId).toBe("ULID-1700000000000");
    });

    it("preserves an explicit draft.eventId (does not call idGen)", async () => {
        const h = setup();

        const result = await h.service.append({
            eventId: "explicit-id",
            eventType: "task.created",
            eventTime: 1_700_000_000_000,
            schemaVer: 1,
            aggregateId: "t-1",
            actor: "system",
            payload: { task_id: "t-1", title: "x", slug: "x", kind: "primary" },
        });

        expect(h.idGen.newUlid).not.toHaveBeenCalled();
        expect(result.eventId).toBe("explicit-id");
    });

    it("uses clock.nowMs() for recordedAt when no draft.recordedAt is provided", async () => {
        const h = setup();

        const result = await h.service.append({
            eventType: "task.created",
            eventTime: 1_700_000_000_000,
            schemaVer: 1,
            aggregateId: "t-1",
            actor: "system",
            payload: { task_id: "t-1", title: "x", slug: "x", kind: "primary" },
        });

        expect(h.clock.nowMs).toHaveBeenCalled();
        expect(result.recordedAt).toBe(FROZEN_MS);
    });

    it("preserves an explicit draft.recordedAt (does not call clock)", async () => {
        const h = setup();

        const result = await h.service.append({
            eventType: "task.created",
            eventTime: 1_700_000_000_000,
            recordedAt: 1_500_000_000_000,
            schemaVer: 1,
            aggregateId: "t-1",
            actor: "system",
            payload: { task_id: "t-1", title: "x", slug: "x", kind: "primary" },
        });

        expect(h.clock.nowMs).not.toHaveBeenCalled();
        expect(result.recordedAt).toBe(1_500_000_000_000);
    });

    it("rejects drafts with non-finite eventTime via validateDomainEventDraft (no insert, no idGen)", async () => {
        const h = setup();

        await expect(h.service.append({
            eventType: "task.created",
            eventTime: Number.NaN,
            schemaVer: 1,
            aggregateId: "t-1",
            actor: "system",
            payload: { task_id: "t-1", title: "x", slug: "x", kind: "primary" },
        })).rejects.toThrow(/finite eventTime/);

        expect(h.eventsRepo.insert).not.toHaveBeenCalled();
        expect(h.idGen.newUlid).not.toHaveBeenCalled();
    });
});
