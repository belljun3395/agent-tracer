import { Inject, Injectable } from "@nestjs/common";
import { Client } from "@opensearch-project/opensearch";
import type { TaskSearchIndexPort } from "~tracer-api/domain/task/port/task.search.index.port.js";
import { OPENSEARCH_CLIENT, TASKS_INDEX } from "~tracer-api/config/opensearch.client.const.js";
import { errorMessage, logWarn } from "~tracer-api/config/log.js";

/** OpenSearch SDK를 태스크 검색 색인 쓰기 포트에 맞추는 어댑터다. */
@Injectable()
export class OpenSearchTaskIndex implements TaskSearchIndexPort {
    constructor(@Inject(OPENSEARCH_CLIENT) private readonly client: Client) {}

    // 검색 인덱스는 보정 가능한 파생이므로 부분 갱신 실패는 흐름을 막지 않는다.
    async partialUpdate(taskId: string, doc: Record<string, unknown>): Promise<void> {
        try {
            await this.client.update({ index: TASKS_INDEX, id: taskId, body: { doc } });
        } catch (err) {
            logWarn({ msg: "task.searchIndex.update.skipped", taskId, error: errorMessage(err) });
        }
    }
}
