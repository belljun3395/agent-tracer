import { Inject, Injectable } from "@nestjs/common";
import { Client } from "@opensearch-project/opensearch";
import type { TaskSearchHit, TaskSearchPort } from "~tracer-api/domain/search/port/task.search.port.js";
import { OPENSEARCH_CLIENT, TASKS_INDEX } from "~tracer-api/config/opensearch.client.const.js";

interface SearchResponseBody {
    readonly hits: {
        readonly hits: ReadonlyArray<{ readonly _id: string; readonly _source?: Record<string, unknown> }>;
    };
}

/** OpenSearch SDK를 태스크 전문검색 포트에 맞추는 어댑터다. */
@Injectable()
export class OpenSearchTaskQuery implements TaskSearchPort {
    constructor(@Inject(OPENSEARCH_CLIENT) private readonly client: Client) {}

    async search(userId: string, q: string, limit: number): Promise<TaskSearchHit[]> {
        const response = await this.client.search({
            index: TASKS_INDEX,
            body: {
                size: limit,
                query: {
                    bool: {
                        must: [{ multi_match: { query: q, fields: ["title", "workspacePath"] } }],
                        filter: [{ term: { userId } }, { term: { hidden: false } }],
                    },
                },
            },
        });
        const body = response.body as unknown as SearchResponseBody;
        return body.hits.hits.map((hit) => toTaskHit(hit._id, hit._source ?? {}));
    }
}

function toTaskHit(id: string, source: Record<string, unknown>): TaskSearchHit {
    return {
        id,
        taskId: id,
        title: readString(source["title"]) ?? "",
        status: readString(source["status"]) ?? "",
        ...(readString(source["origin"]) !== undefined ? { origin: readString(source["origin"])! } : {}),
        ...(readString(source["taskKind"]) !== undefined ? { taskKind: readString(source["taskKind"])! } : {}),
        ...(readString(source["workspacePath"]) !== undefined ? { workspacePath: readString(source["workspacePath"])! } : {}),
        archived: source["archived"] === true,
        ...(readString(source["updatedAt"]) !== undefined ? { updatedAt: readString(source["updatedAt"])! } : {}),
    };
}

function readString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
