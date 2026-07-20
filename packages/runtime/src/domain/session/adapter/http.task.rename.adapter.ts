import {AGENT_TITLE_RANK} from "@monitor/kernel/ingest/task.const.js";
import {patchJson} from "~runtime/config/http.js";
import type {TaskRenamePort} from "~runtime/domain/session/port/task.rename.port.js";

/** 에이전트가 다시 지은 제목을 태스크 커맨드 API로 agent 순위로 직접 보낸다. */
export class HttpTaskRenameAdapter implements TaskRenamePort {
    constructor(
        private readonly baseUrl: string,
        private readonly headers: Record<string, string>,
    ) {}

    async rename(taskId: string, title: string): Promise<boolean> {
        const url = `${this.baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}`;
        const response = await patchJson(url, this.headers, {title, titleRank: AGENT_TITLE_RANK});
        return response.ok;
    }
}
