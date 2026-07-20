import {MEMOS_PATH} from "@monitor/kernel/api/memo.query.const.js";
import {getJson} from "~runtime/config/http.js";
import type {MemoSearchPort, MemoSearchResultItem} from "~runtime/domain/memo/port/memo.search.port.js";
import {isRecord} from "~runtime/support/json.js";

const FETCH_TIMEOUT_MS = 3000;

interface MemosEnvelope {
    readonly data?: {readonly items?: unknown[]};
}

/** 서버 메모 목록을 캐시 없이 매 호출 라이브로 읽는다. */
export class HttpMemoSearchAdapter implements MemoSearchPort {
    constructor(
        private readonly baseUrl: string,
        private readonly headers: Record<string, string>,
    ) {}

    async listByTask(taskId: string): Promise<readonly MemoSearchResultItem[]> {
        const fetched = await getJson<MemosEnvelope>(
            `${this.baseUrl}${MEMOS_PATH}?taskId=${encodeURIComponent(taskId)}`,
            this.headers,
            FETCH_TIMEOUT_MS,
        );
        const rawItems = fetched.kind === "found" ? fetched.value.data?.items : undefined;
        const items = Array.isArray(rawItems) ? rawItems : [];
        return items.map(parseMemoItem).filter((item): item is MemoSearchResultItem => item !== null);
    }
}

function parseMemoItem(item: unknown): MemoSearchResultItem | null {
    if (!isRecord(item)) return null;
    const id = item["id"];
    const taskId = item["taskId"];
    const body = item["body"];
    if (typeof id !== "string" || typeof taskId !== "string" || typeof body !== "string") return null;
    const eventId = item["eventId"];
    const author = item["author"];
    const updatedAt = item["updatedAt"];
    return {
        id,
        taskId,
        eventId: typeof eventId === "string" ? eventId : null,
        author: typeof author === "string" ? author : "",
        body,
        ...(typeof updatedAt === "string" ? {updatedAt} : {}),
    };
}
