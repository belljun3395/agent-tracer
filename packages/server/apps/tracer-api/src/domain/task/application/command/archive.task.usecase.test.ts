import { describe, expect, it, vi } from "vitest";
import type { TaskUserStateService } from "~tracer-api/domain/task/application/task.user.state.service.js";
import { ArchiveTaskUseCase } from "./archive.task.usecase.js";

describe("ArchiveTaskUseCase", () => {
    it("보관을 서비스에 위임하고 보관됨을 응답한다", async () => {
        const archive = vi.fn(async () => undefined);
        const useCase = new ArchiveTaskUseCase({ archive } as unknown as TaskUserStateService);

        const result = await useCase.execute("u1", "t1");

        expect(archive).toHaveBeenCalledWith("u1", "t1");
        expect(result).toEqual({ taskId: "t1", archived: true });
    });
});
