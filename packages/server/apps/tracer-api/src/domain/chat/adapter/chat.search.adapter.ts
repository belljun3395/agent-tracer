import { Inject, Injectable } from "@nestjs/common";
import { Client } from "@opensearch-project/opensearch";
import { EVENTS_INDEX, MEMOS_INDEX, OPENSEARCH_CLIENT } from "~tracer-api/config/opensearch.client.const.js";
import type {
    ChatEventSearchPort,
    ChatSearchHit,
    ChatSearchQuery,
} from "~tracer-api/domain/chat/port/chat.search.port.js";

interface SearchResponseBody {
    readonly hits: {
        readonly hits: ReadonlyArray<{ readonly _id: string; readonly _source?: Record<string, unknown> }>;
    };
}

/** 대화 도구의 전문 검색을 OpenSearch 이벤트·메모 색인에 맞추는 어댑터다. */
@Injectable()
export class ChatOpenSearchAdapter implements ChatEventSearchPort {
    constructor(@Inject(OPENSEARCH_CLIENT) private readonly client: Client) {}

    async search(query: ChatSearchQuery): Promise<readonly ChatSearchHit[]> {
        const [events, memos] = await Promise.all([this.searchEvents(query), this.searchMemos(query)]);
        return [...events, ...memos];
    }

    private async searchEvents(query: ChatSearchQuery): Promise<ChatSearchHit[]> {
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
        const must = query.q ? [{ multi_match: { query: query.q, fields: ["title", "body"] } }] : [{ match_all: {} }];
        const body = await this.run(EVENTS_INDEX, query.limit, "occurredAt", must, filter);
        return body.hits.hits.map((hit) => toEventHit(hit._id, hit._source ?? {}));
    }

    private async searchMemos(query: ChatSearchQuery): Promise<ChatSearchHit[]> {
        const filter: Record<string, unknown>[] = [
            { term: { userId: query.userId } },
            { exists: { field: "eventId" } },
        ];
        if (query.taskId !== undefined) filter.push({ term: { taskId: query.taskId } });
        const must = query.q ? [{ multi_match: { query: query.q, fields: ["body"] } }] : [{ match_all: {} }];
        const body = await this.run(MEMOS_INDEX, query.limit, "updatedAt", must, filter);
        return body.hits.hits.map((hit) => toMemoHit(hit._id, hit._source ?? {}));
    }

    private async run(
        index: string,
        size: number,
        sortField: string,
        must: Record<string, unknown>[],
        filter: Record<string, unknown>[],
    ): Promise<SearchResponseBody> {
        const response = await this.client.search({
            index,
            body: { size, sort: [{ [sortField]: "desc" }], query: { bool: { must, filter } } },
        });
        return response.body as unknown as SearchResponseBody;
    }
}

function readString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toEventHit(id: string, source: Record<string, unknown>): ChatSearchHit {
    return {
        hitType: "event",
        id,
        taskId: readString(source["taskId"]) ?? "",
        title: readString(source["title"]) ?? "",
        ...(readString(source["body"]) !== undefined ? { body: readString(source["body"])! } : {}),
        kind: readString(source["kind"]) ?? "",
        lane: readString(source["lane"]) ?? "",
        ...(readString(source["toolName"]) !== undefined ? { toolName: readString(source["toolName"])! } : {}),
        ...(readString(source["occurredAt"]) !== undefined ? { occurredAt: readString(source["occurredAt"])! } : {}),
    };
}

function toMemoHit(id: string, source: Record<string, unknown>): ChatSearchHit {
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
