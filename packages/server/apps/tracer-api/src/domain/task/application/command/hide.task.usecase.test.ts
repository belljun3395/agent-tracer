import { describe, expect, it, vi } from "vitest";
import type { TaskUserStateService } from "~tracer-api/domain/task/application/task.user.state.service.js";
import { HideTaskUseCase } from "./hide.task.usecase.js";

describe("HideTaskUseCase", () => {
    it("숨김을 서비스에 위임하고 숨겨짐을 응답한다", async () => {
        const hide = vi.fn(async () => undefined);
        const useCase = new HideTaskUseCase({ hide } as unknown as TaskUserStateService);

        const result = await useCase.execute("u1", "t1");

        expect(hide).toHaveBeenCalledWith("u1", "t1");
        expect(result).toEqual({ taskId: "t1", hidden: true });
    });
});
