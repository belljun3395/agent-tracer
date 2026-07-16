import type {MemoSearchPort, MemoSearchResultItem} from "~runtime/domain/memo/port/memo.search.port.js";

export class InMemoryMemoSearch implements MemoSearchPort {
    private readonly rows = new Map<string, MemoSearchResultItem[]>();
    private shouldFail = false;

    seed(taskId: string, items: readonly MemoSearchResultItem[]): void {
        this.rows.set(taskId, [...items]);
    }

    /** 서버 조회가 실패하는 상황을 재현한다. */
    failNext(): void {
        this.shouldFail = true;
    }

    async listByTask(taskId: string): Promise<readonly MemoSearchResultItem[]> {
        if (this.shouldFail) throw new Error("search failed");
        return this.rows.get(taskId) ?? [];
    }
}
