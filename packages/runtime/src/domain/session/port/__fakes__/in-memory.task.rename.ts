import type {TaskRenamePort} from "~runtime/domain/session/port/task.rename.port.js";

export class InMemoryTaskRename implements TaskRenamePort {
    readonly renamed: {readonly taskId: string; readonly title: string}[] = [];
    private shouldFail = false;

    /** 서버 쓰기가 실패하는 상황을 재현한다. */
    failNext(): void {
        this.shouldFail = true;
    }

    async rename(taskId: string, title: string): Promise<boolean> {
        if (this.shouldFail) throw new Error("rename failed");
        this.renamed.push({taskId, title});
        return true;
    }
}
