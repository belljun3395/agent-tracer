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
    } as unknown as TimelineEventRepository & { findOwned: Mock; findByTaskIdOrdered: Mock };
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
});
