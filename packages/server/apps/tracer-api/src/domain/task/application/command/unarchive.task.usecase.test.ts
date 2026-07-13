import { describe, expect, it, vi } from "vitest";
import type { TaskUserStateService } from "~tracer-api/domain/task/application/task.user.state.service.js";
import { UnarchiveTaskUseCase } from "./unarchive.task.usecase.js";

describe("UnarchiveTaskUseCase", () => {
    it("보관 해제를 서비스에 위임하고 해제됨을 응답한다", async () => {
        const unarchive = vi.fn(async () => undefined);
        const useCase = new UnarchiveTaskUseCase({ unarchive } as unknown as TaskUserStateService);

        const result = await useCase.execute("u1", "t1");

        expect(unarchive).toHaveBeenCalledWith("u1", "t1");
        expect(result).toEqual({ taskId: "t1", archived: false });
    });
});
