import { Inject, Injectable } from "@nestjs/common";
import { Client } from "@opensearch-project/opensearch";
import type { MemoSearchHit, MemoSearchPort, MemoSearchQuery } from "~tracer-api/domain/search/port/memo.search.port.js";
import { MEMOS_INDEX, OPENSEARCH_CLIENT } from "~tracer-api/config/opensearch.client.const.js";

interface SearchResponseBody {
    readonly hits: {
        readonly hits: ReadonlyArray<{ readonly _id: string; readonly _source?: Record<string, unknown> }>;
    };
}

/** OpenSearch SDK를 메모 검색 포트에 맞추는 어댑터다. */
@Injectable()
export class OpenSearchMemoSearch implements MemoSearchPort {
    constructor(@Inject(OPENSEARCH_CLIENT) private readonly client: Client) {}

    async search(query: MemoSearchQuery): Promise<MemoSearchHit[]> {
        const filter: Record<string, unknown>[] = [
            { term: { userId: query.userId } },
            query.hasEvent ? { exists: { field: "eventId" } } : { bool: { must_not: [{ exists: { field: "eventId" } }] } },
        ];
        if (query.taskId !== undefined) filter.push({ term: { taskId: query.taskId } });
        const must = query.q ? [{ multi_match: { query: query.q, fields: ["body"] } }] : [{ match_all: {} }];

        const response = await this.client.search({
            index: MEMOS_INDEX,
            body: { size: query.limit, sort: [{ updatedAt: "desc" }], query: { bool: { must, filter } } },
        });
        const body = response.body as unknown as SearchResponseBody;
        return body.hits.hits.map((hit) => toMemoHit(hit._id, hit._source ?? {}));
    }
}

function toMemoHit(id: string, source: Record<string, unknown>): MemoSearchHit {
    return {
        hitType: "memo",
        id,
        taskId: readString(source["taskId"]) ?? "",
        eventId: readString(source["eventId"]) ?? null,
        author: readString(source["author"]) ?? "",
        body: readString(source["body"]) ?? "",
        ...(readString(source["updatedAt"]) !== undefined ? { updatedAt: readString(source["updatedAt"])! } : {}),
    };
}

function readString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
