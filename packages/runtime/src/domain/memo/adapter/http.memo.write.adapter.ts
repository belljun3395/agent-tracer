import {MEMO_AUTHOR} from "@monitor/kernel/memo/memo.const.js";
import {MEMOS_PATH} from "@monitor/kernel/api/memo.query.const.js";
import {postJson} from "~runtime/config/http.js";
import type {MemoWriteInput, MemoWritePort} from "~runtime/domain/memo/port/memo.write.port.js";

/** 에이전트가 남긴 메모를 서버의 메모 커맨드 API로 직접 보낸다. */
export class HttpMemoWriteAdapter implements MemoWritePort {
    constructor(
        private readonly baseUrl: string,
        private readonly headers: Record<string, string>,
    ) {}

    async create(input: MemoWriteInput): Promise<boolean> {
        const response = await postJson(`${this.baseUrl}${MEMOS_PATH}`, this.headers, {
            taskId: input.taskId,
            body: input.body,
            author: MEMO_AUTHOR.agent,
            ...(input.eventId !== undefined ? {eventId: input.eventId} : {}),
        });
        return response.ok;
    }
}
