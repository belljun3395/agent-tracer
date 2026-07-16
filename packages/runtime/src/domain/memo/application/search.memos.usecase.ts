import type {MemoSearchPort, MemoSearchResultItem} from "~runtime/domain/memo/port/memo.search.port.js";

const DEFAULT_LIMIT = 20;

export interface SearchMemosInput {
    readonly taskId: string;
    readonly query?: string;
    readonly limit?: number;
}

/** query가 없으면 활성 태스크 메모를 나열하고, 있으면 본문에서 부분일치로 좁힌다. */
export class SearchMemosUsecase {
    constructor(private readonly reader: MemoSearchPort) {}

    async execute(input: SearchMemosInput): Promise<readonly MemoSearchResultItem[]> {
        if (input.taskId === "") return [];
        let items: readonly MemoSearchResultItem[];
        try {
            items = await this.reader.listByTask(input.taskId);
        } catch {
            return [];
        }
        const filtered = filterByQuery(items, input.query);
        const limit = input.limit ?? DEFAULT_LIMIT;
        return filtered.slice(0, limit);
    }
}

function filterByQuery(items: readonly MemoSearchResultItem[], query: string | undefined): readonly MemoSearchResultItem[] {
    const trimmed = query?.trim().toLowerCase();
    if (!trimmed) return items;
    return items.filter((item) => item.body.toLowerCase().includes(trimmed));
}
