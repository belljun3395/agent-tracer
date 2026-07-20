import { Inject, Injectable } from "@nestjs/common";
import { Client } from "@opensearch-project/opensearch";
import type { EventSearchHit, EventSearchPort, EventSearchQuery } from "~tracer-api/domain/search/port/event.search.port.js";
import { EVENTS_INDEX, OPENSEARCH_CLIENT } from "~tracer-api/config/opensearch.client.const.js";
import { readString, readStringArray } from "~tracer-api/domain/search/adapter/opensearch.field.reader.js";

interface SearchResponseBody {
    readonly hits: {
        readonly hits: ReadonlyArray<{ readonly _id: string; readonly _source?: Record<string, unknown> }>;
    };
}

/** OpenSearch SDK를 이벤트 검색 포트에 맞추는 어댑터다. */
@Injectable()
export class OpenSearchEventSearch implements EventSearchPort {
    constructor(@Inject(OPENSEARCH_CLIENT) private readonly client: Client) {}

    async search(query: EventSearchQuery): Promise<EventSearchHit[]> {
        const filter: Record<string, unknown>[] = [{ term: { userId: query.userId } }];
        if (query.taskId !== undefined) filter.push({ term: { taskId: query.taskId } });
        if (query.kind !== undefined) filter.push({ term: { kind: query.kind } });
        if (query.lane !== undefined) filter.push({ term: { lane: query.lane } });
        if (query.from !== undefined || query.to !== undefined) {
            filter.push({
                range: {
                    occurredAt: {
                        ...(query.from !== undefined ? { gte: query.from } : {}),
                        ...(query.to !== undefined ? { lte: query.to } : {}),
                    },
                },
            });
        }
        const must = query.q
            ? [{ multi_match: { query: query.q, fields: ["title", "body"] } }]
            : [{ match_all: {} }];

        const response = await this.client.search({
            index: EVENTS_INDEX,
            body: { size: query.limit, sort: [{ occurredAt: "desc" }], query: { bool: { must, filter } } },
        });
        const body = response.body as unknown as SearchResponseBody;
        return body.hits.hits.map((hit) => toEventHit(hit._id, hit._source ?? {}));
    }
}

function toEventHit(id: string, source: Record<string, unknown>): EventSearchHit {
    return {
        id,
        taskId: readString(source["taskId"]) ?? "",
        ...(readString(source["sessionId"]) !== undefined ? { sessionId: readString(source["sessionId"])! } : {}),
        ...(readString(source["turnId"]) !== undefined ? { turnId: readString(source["turnId"])! } : {}),
        kind: readString(source["kind"]) ?? "",
        lane: readString(source["lane"]) ?? "",
        title: readString(source["title"]) ?? "",
        ...(readString(source["body"]) !== undefined ? { body: readString(source["body"])! } : {}),
        ...(readString(source["toolName"]) !== undefined ? { toolName: readString(source["toolName"])! } : {}),
        filePaths: readStringArray(source["filePaths"]),
        ...(typeof source["seq"] === "number" || typeof source["seq"] === "string" ? { seq: String(source["seq"]) } : {}),
        ...(readString(source["occurredAt"]) !== undefined ? { occurredAt: readString(source["occurredAt"])! } : {}),
    };
}


