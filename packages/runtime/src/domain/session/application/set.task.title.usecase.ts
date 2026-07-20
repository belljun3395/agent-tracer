import type {TaskRenamePort} from "~runtime/domain/session/port/task.rename.port.js";

/** 다른 MCP 도구와 같은 방식으로, 에이전트가 스스로 판단한 더 나은 제목을 태스크 커맨드 API에 직접 보낸다. */
export class SetTaskTitleUsecase {
    constructor(private readonly renamer: TaskRenamePort) {}

    async execute(taskId: string, title: string): Promise<boolean> {
        const trimmed = title.trim();
        if (taskId === "" || trimmed === "") return false;
        try {
            return await this.renamer.rename(taskId, trimmed);
        } catch {
            return false;
        }
    }
}
