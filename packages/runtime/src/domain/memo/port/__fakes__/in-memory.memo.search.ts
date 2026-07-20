import type {MemoSearchPort, MemoSearchResultItem} from "~runtime/domain/memo/port/memo.search.port.js";
import type {Fetched} from "~runtime/support/fetched.js";

export class InMemoryMemoSearch implements MemoSearchPort {
    private readonly rows = new Map<string, MemoSearchResultItem[]>();
    private nextThrows = false;
    private nextUnavailable = false;

    seed(taskId: string, items: readonly MemoSearchResultItem[]): void {
        this.rows.set(taskId, [...items]);
    }

    /** 서버 조회가 예외로 튀는 상황을 재현한다. */
    failNext(): void {
        this.nextThrows = true;
    }

    /** 서버 접속은 됐지만 확답을 못 받은 상황을 재현한다. */
    respondUnavailableNext(): void {
        this.nextUnavailable = true;
    }

    async listByTask(taskId: string): Promise<Fetched<readonly MemoSearchResultItem[]>> {
        if (this.nextThrows) throw new Error("search failed");
        if (this.nextUnavailable) return {kind: "unavailable"};
        return {kind: "found", value: this.rows.get(taskId) ?? []};
    }
}
