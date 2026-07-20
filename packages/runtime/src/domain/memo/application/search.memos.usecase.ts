import type {MemoSearchPort, MemoSearchResultItem} from "~runtime/domain/memo/port/memo.search.port.js";
import type {Fetched} from "~runtime/support/fetched.js";

const DEFAULT_LIMIT = 20;

export interface SearchMemosInput {
    readonly taskId: string;
    readonly query?: string;
    readonly limit?: number;
}

/** query가 없으면 활성 태스크 메모를 나열하고, 있으면 본문에서 부분일치로 좁히며 접속 실패를 구분해 낸다. */
export class SearchMemosUsecase {
    constructor(private readonly reader: MemoSearchPort) {}

    async execute(input: SearchMemosInput): Promise<Fetched<readonly MemoSearchResultItem[]>> {
        if (input.taskId === "") return {kind: "found", value: []};
        let fetched: Fetched<readonly MemoSearchResultItem[]>;
        try {
            fetched = await this.reader.listByTask(input.taskId);
        } catch {
            return {kind: "unavailable"};
        }
        if (fetched.kind !== "found") return fetched;
        const filtered = filterByQuery(fetched.value, input.query);
        const limit = input.limit ?? DEFAULT_LIMIT;
        return {kind: "found", value: filtered.slice(0, limit)};
    }
}

function filterByQuery(items: readonly MemoSearchResultItem[], query: string | undefined): readonly MemoSearchResultItem[] {
    const trimmed = query?.trim().toLowerCase();
    if (!trimmed) return items;
    return items.filter((item) => item.body.toLowerCase().includes(trimmed));
}
