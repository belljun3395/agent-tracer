import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { GetTurnPartitionUseCase } from "./get.turn.partition.usecase.js";
import type { IClock } from "./outbound/clock.port.js";
import type { IIdGenerator } from "./outbound/id.generator.port.js";
import type { ITaskAccess } from "./outbound/task.access.port.js";
import type {
    ITimelineEventAccess,
    TimelineEventAccessRecord,
} from "./outbound/timeline.event.access.port.js";
import type { TurnPartitionRepository } from "../repository/turn.partition.repository.js";
import type { TurnPartition } from "../domain/turn.partition.model.js";
import { TaskNotFoundError } from "../common/turn.partition.errors.js";

const NOW_ISO = "2026-04-29T10:00:00.000Z";

function userMessage(id: string, createdAt: string): TimelineEventAccessRecord {
    return {
        id,
        taskId: "t-1",
        kind: "user.message",
        lane: "user",
        title: "u",
        metadata: {},
        classification: { lane: "user", tags: [], matches: [] },
        createdAt,
    };
}

function setup(opts: { taskFound?: boolean; events?: TimelineEventAccessRecord[]; stored?: ReturnType<TurnPartitionRepository["get"]> extends Promise<infer T> ? T : never } = {}) {
    const tasks = {
        findById: vi.fn(async () => (opts.taskFound === false ? null : { id: "t-1" })),
    } as unknown as ITaskAccess & { findById: Mock };
    const events = {
        findByTaskId: vi.fn(async () => opts.events ?? []),
    } as unknown as ITimelineEventAccess & { findByTaskId: Mock };
    const turnPartitions = {
        get: vi.fn(async () => opts.stored ?? null),
        upsert: vi.fn(),
        delete: vi.fn(),
    } as unknown as TurnPartitionRepository & { get: Mock; upsert: Mock; delete: Mock };
    const clock: IClock & { nowIso: Mock; nowMs: Mock } = {
        nowIso: vi.fn(() => NOW_ISO),
        nowMs: vi.fn(() => Date.parse(NOW_ISO)),
    };
    let i = 0;
    const idGen: IIdGenerator & { newUuid: Mock } = {
        newUuid: vi.fn(() => {
            i += 1;
            return `id-${i}`;
        }),
    };

    const usecase = new GetTurnPartitionUseCase(tasks, events, turnPartitions, clock, idGen);
    return { usecase, tasks, events, turnPartitions, clock, idGen };
}

describe("GetTurnPartitionUseCase", () => {
    it("throws TaskNotFoundError when the task does not exist", async () => {
        const h = setup({ taskFound: false });

        await expect(h.usecase.execute({ taskId: "missing" })).rejects.toBeInstanceOf(TaskNotFoundError);
        expect(h.events.findByTaskId).not.toHaveBeenCalled();
    });

    it("uses IClock.nowIso for fallbackUpdatedAt and idGen.newUuid for group ids when no partition is stored", async () => {
        const h = setup({
            events: [
                userMessage("u-1", "2026-04-29T10:00:00.000Z"),
                userMessage("u-2", "2026-04-29T10:05:00.000Z"),
            ],
            stored: null,
        });

        const result = (await h.usecase.execute({ taskId: "t-1" })) as TurnPartition;

        expect(h.clock.nowIso).toHaveBeenCalled();
        expect(result.updatedAt).toBe(NOW_ISO);
        expect(result.groups.map((g) => g.id)).toEqual(["tg-id-1", "tg-id-2"]);
    });

    it("returns the stored partition unchanged when it validates against current totals", async () => {
        const stored = {
            taskId: "t-1",
            groups: [{ id: "tg-keep", from: 1, to: 1, label: null, visible: true }],
            version: 9,
            updatedAt: "2026-04-29T09:00:00.000Z",
        };
        const h = setup({
            events: [userMessage("u-1", "2026-04-29T10:00:00.000Z")],
            stored,
        });

        const result = await h.usecase.execute({ taskId: "t-1" });

        expect(result).toBe(stored);
        expect(h.idGen.newUuid).not.toHaveBeenCalled();
    });
});
