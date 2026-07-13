import { describe, expect, it, vi } from "vitest";
import { JOB_KIND, JOB_STATUS } from "@monitor/kernel";
import { AiJobEntity } from "@monitor/tracer-domain";
import type { AiJobRepositoryPort } from "~tracer-api/domain/job/port/ai.job.repository.port.js";
import { ListJobHistoryUseCase } from "./list.job.history.usecase.js";

vi.mock("@monitor/platform", () => ({
    DomainError: class DomainError extends Error {},
    generateUlid: () => crypto.randomUUID(),
    createTemporalConnection: vi.fn(),
}));

const NOW = new Date("2026-01-01T00:00:00.000Z");

describe("ListJobHistoryUseCase", () => {
    it("사용자의 잡 목록과 전체 개수를 반환한다", async () => {
        const job = AiJobEntity.create("u1", JOB_KIND.recipeScan, {}, NOW);
        const findHistoryByUser = vi.fn().mockResolvedValue({ items: [job], total: 7 });
        const useCase = new ListJobHistoryUseCase({ findHistoryByUser } as unknown as AiJobRepositoryPort);

        const result = await useCase.execute("u1", { limit: 50, offset: 0 });

        expect(result.total).toBe(7);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({ id: job.id, status: JOB_STATUS.pending });
    });

    it("종류·상태·페이지 조건을 저장소에 그대로 전달한다", async () => {
        const findHistoryByUser = vi.fn().mockResolvedValue({ items: [], total: 0 });
        const useCase = new ListJobHistoryUseCase({ findHistoryByUser } as unknown as AiJobRepositoryPort);

        await useCase.execute("u1", {
            kind: JOB_KIND.titleSuggestion,
            status: JOB_STATUS.running,
            limit: 10,
            offset: 20,
        });

        expect(findHistoryByUser).toHaveBeenCalledWith("u1", {
            kind: JOB_KIND.titleSuggestion,
            status: JOB_STATUS.running,
            limit: 10,
            offset: 20,
        });
    });
});
