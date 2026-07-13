import { describe, expect, it, vi } from "vitest";
import type { TaskUserStateService } from "~tracer-api/domain/task/application/task.user.state.service.js";
import { RenameTaskUseCase } from "./rename.task.usecase.js";

describe("RenameTaskUseCase", () => {
    it("개명을 서비스에 위임하고 바뀐 제목을 응답한다", async () => {
        const rename = vi.fn(async () => undefined);
        const useCase = new RenameTaskUseCase({ rename } as unknown as TaskUserStateService);

        const result = await useCase.execute("u1", "t1", "새 제목");

        expect(rename).toHaveBeenCalledWith("u1", "t1", "새 제목");
        expect(result).toEqual({ taskId: "t1", title: "새 제목" });
    });
});
