import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Repository } from "typeorm";
import { DbBackedPostProcessingQueue } from "./post.processing.queue.adapter.js";
import type { EventProcessingJobEntity } from "~activity/event/domain/event-store/event.processing.job.entity.js";
import type { IClock } from "../application/outbound/clock.port.js";
import type { IIdGenerator } from "../application/outbound/id.generator.port.js";

const NOW_ISO = "2026-04-29T10:00:00.000Z";

function setup() {
    const repo = {
        insert: vi.fn(async () => undefined),
    } as unknown as Repository<EventProcessingJobEntity> & { insert: Mock };
    const clock: IClock & { nowIso: Mock; nowMs: Mock } = {
        nowIso: vi.fn(() => NOW_ISO),
        nowMs: vi.fn(() => Date.parse(NOW_ISO)),
    };
    const idGen: IIdGenerator & { newUuid: Mock; newUlid: Mock } = {
        newUuid: vi.fn(() => "job-id-1"),
        newUlid: vi.fn(() => "ulid-noop"),
    };
    const queue = new DbBackedPostProcessingQueue(repo, clock, idGen);
    return { queue, repo, clock, idGen };
}

describe("DbBackedPostProcessingQueue.enqueue", () => {
    it("uses IIdGenerator for jobId and IClock for createdAt/updatedAt (deterministic)", async () => {
        const h = setup();

        await h.queue.enqueue({ eventId: "evt-1", jobType: "verification.user_message" });

        expect(h.idGen.newUuid).toHaveBeenCalledTimes(1);
        expect(h.clock.nowIso).toHaveBeenCalled();
        const inserted = h.repo.insert.mock.calls[0]![0];
        expect(inserted).toMatchObject({
            jobId: "job-id-1",
            eventId: "evt-1",
            jobType: "verification.user_message",
            status: "pending",
            attempts: 0,
            createdAt: NOW_ISO,
            updatedAt: NOW_ISO,
            lastError: null,
        });
    });

    it("forwards every supported jobType verbatim", async () => {
        const h = setup();

        for (const jobType of ["verification.user_message", "verification.assistant_response", "verification.other_event"] as const) {
            await h.queue.enqueue({ eventId: `evt-${jobType}`, jobType });
        }

        const types = h.repo.insert.mock.calls.map((c) => (c[0] as { jobType: string }).jobType);
        expect(types).toEqual([
            "verification.user_message",
            "verification.assistant_response",
            "verification.other_event",
        ]);
    });
});
