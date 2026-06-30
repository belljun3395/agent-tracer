import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { DataSource } from "typeorm";
import { TimelineEventStorageService } from "./timeline.event.storage.service.js";
import type { TimelineEventRepository } from "../repository/timeline.event.repository.js";

function setup() {
    const repo = {
        findOwned: vi.fn(),
        findByTaskIdOrdered: vi.fn(),
        save: vi.fn(),
        insertIgnoreConflict: vi.fn(),
    } as unknown as TimelineEventRepository & {
        findOwned: Mock;
        findByTaskIdOrdered: Mock;
        insertIgnoreConflict: Mock;
    };
    const dataSource = { query: vi.fn(async () => []) } as unknown as DataSource;
    const service = new TimelineEventStorageService(repo, dataSource);
    return { service, repo };
}

describe("TimelineEventStorageService ownership scope", () => {
    it("findById scopes the lookup to the current user", async () => {
        const { service, repo } = setup();
        repo.findOwned.mockResolvedValue(null);

        const result = await service.findById("e-1");

        expect(result).toBeNull();
        expect(repo.findOwned).toHaveBeenCalledWith("e-1", "local");
    });

    it("findByTaskId scopes the lookup to the current user", async () => {
        const { service, repo } = setup();
        repo.findByTaskIdOrdered.mockResolvedValue([]);

        const result = await service.findByTaskId("t-1");

        expect(result).toEqual([]);
        expect(repo.findByTaskIdOrdered).toHaveBeenCalledWith("t-1", "local");
    });

    it("insert writes via ON CONFLICT DO NOTHING and returns the event without a re-query", async () => {
        const { service, repo } = setup();
        repo.insertIgnoreConflict.mockResolvedValue(undefined);

        const result = await service.insert({
            id: "e-1",
            taskId: "t-1",
            kind: "tool.used",
            lane: "implementation",
            title: "ran tests",
            metadata: { foo: "bar" },
            classification: { lane: "implementation", tags: ["t"], matches: [] },
            createdAt: "2026-06-30T00:00:00.000Z",
        });

        expect(repo.insertIgnoreConflict).toHaveBeenCalledTimes(1);
        // 새 이벤트는 룰 오버라이드가 없어 재조회하지 않는다.
        expect(repo.findOwned).not.toHaveBeenCalled();
        expect(result.id).toBe("e-1");
        expect(result.metadata).toMatchObject({ foo: "bar" });
    });
});
