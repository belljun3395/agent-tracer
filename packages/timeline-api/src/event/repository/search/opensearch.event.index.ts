import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Client } from "@opensearch-project/opensearch";
import { DataSource } from "typeorm";
import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import { normalizeLane } from "@monitor/timeline-api/event/domain/event.lane.js";
import type {
    EventSearchIndexQueryOptions,
    EventSearchIndexResults,
    IEventSearchIndex,
} from "@monitor/timeline-api/event/application/outbound/event.search.index.port.js";
import { OPENSEARCH_CLIENT } from "../../public/tokens.js";

export { OPENSEARCH_CLIENT };

const INDEX = "agent_tracer_events";
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 8;

interface EventRow {
    readonly id: string;
    readonly user_id: string;
    readonly task_id: string;
    readonly kind: string;
    readonly lane: string;
    readonly title: string;
    readonly body: string | null;
    readonly created_at: string;
}

interface TaskRow {
    readonly id: string;
    readonly title: string;
    readonly workspace_path: string | null;
    readonly status: string;
    readonly updated_at: string;
}

interface IndexedEvent {
    readonly userId: string;
    readonly taskId: string;
    readonly kind: string;
    readonly lane: string;
    readonly title: string;
    readonly body: string | null;
    readonly searchText: string;
    readonly createdAt: string;
}

interface OsHit {
    readonly _id: string;
    readonly _source: IndexedEvent;
}

interface ExistsCheck {
    readonly body: boolean;
}

/**
 * 타임라인 이벤트 검색 색인. 이벤트는 OpenSearch 텍스트 색인으로, 태스크는
 * Postgres ILIKE 로 조회한다. 이벤트 쓰기 시점에 동기로 색인을 갱신한다.
 */
@Injectable()
export class OpenSearchEventIndex implements IEventSearchIndex, OnModuleInit {
    private readonly logger = new Logger(OpenSearchEventIndex.name);

    constructor(
        @Inject(OPENSEARCH_CLIENT) private readonly client: Client,
        private readonly dataSource: DataSource,
    ) {}

    async onModuleInit(): Promise<void> {
        const exists = (await this.client.indices.exists({ index: INDEX })) as ExistsCheck;
        if (exists.body) return;
        await this.client.indices.create({
            index: INDEX,
            body: {
                mappings: {
                    properties: {
                        userId: { type: "keyword" },
                        taskId: { type: "keyword" },
                        kind: { type: "keyword" },
                        lane: { type: "keyword" },
                        title: { type: "text" },
                        body: { type: "text" },
                        searchText: { type: "text" },
                        createdAt: { type: "date" },
                    },
                },
            },
        });
    }

    async refresh(eventId: string): Promise<void> {
        const rows = await this.dataSource.query<readonly EventRow[]>(
            `select id, user_id, task_id, kind, lane, title, body, created_at
             from timeline_events_view where id = $1`,
            [eventId],
        );
        const row = rows[0];
        if (!row) {
            await this.client.delete({ index: INDEX, id: eventId }).catch(() => undefined);
            return;
        }
        const searchText = [row.title, row.body, row.kind, row.lane]
            .filter((part): part is string => Boolean(part))
            .join(" ");
        await this.client.index({
            index: INDEX,
            id: row.id,
            refresh: true,
            body: {
                userId: row.user_id,
                taskId: row.task_id,
                kind: row.kind,
                lane: row.lane,
                title: row.title,
                body: row.body,
                searchText,
                createdAt: row.created_at,
            } satisfies IndexedEvent,
        });
    }

    async search(query: string, options: EventSearchIndexQueryOptions): Promise<EventSearchIndexResults> {
        const limit = Math.max(1, Math.min(MAX_LIMIT, options.limit ?? DEFAULT_LIMIT));
        const userId = currentUserId();
        const [events, tasks] = await Promise.all([
            this.searchEvents(query, options.taskId, limit, userId),
            this.searchTasks(query, limit, userId),
        ]);
        return { tasks, events, bookmarks: [] };
    }

    private async searchEvents(
        query: string,
        taskId: string | undefined,
        limit: number,
        userId: string,
    ): Promise<readonly unknown[]> {
        let parsed: readonly OsHit[] = [];
        try {
            const response = await this.client.search({
                index: INDEX,
                body: {
                    size: limit,
                    query: {
                        bool: {
                            must: [
                                {
                                    simple_query_string: {
                                        query,
                                        fields: ["searchText", "title^2", "body"],
                                        default_operator: "and",
                                    },
                                },
                            ],
                            filter: [
                                { term: { userId } },
                                ...(taskId ? [{ term: { taskId } }] : []),
                            ],
                        },
                    },
                },
            });
            const rawHits = response.body.hits.hits;
            parsed = rawHits.flatMap((rawHit) => {
                const hit = rawHit as { _id?: string; _source?: IndexedEvent };
                if (!hit._id || !hit._source) return [];
                return [{ _id: hit._id, _source: hit._source }];
            });
        } catch (error) {
            // 색인이 비어 있거나 OpenSearch 가 일시적으로 응답하지 않으면 빈 결과로 둔다.
            this.logger.warn(`event search failed: ${error instanceof Error ? error.message : String(error)}`);
            return [];
        }
        if (parsed.length === 0) return [];

        const taskTitles = await this.loadTaskTitles(parsed.map((hit) => hit._source.taskId));
        return parsed.map((hit) => {
            const source = hit._source;
            return {
                id: hit._id,
                eventId: hit._id,
                taskId: source.taskId,
                taskTitle: taskTitles.get(source.taskId) ?? "",
                title: source.title,
                lane: normalizeLane(source.lane),
                kind: source.kind,
                createdAt: source.createdAt,
                ...(source.body ? { snippet: source.body } : {}),
            };
        });
    }

    private async loadTaskTitles(taskIds: readonly string[]): Promise<Map<string, string>> {
        const unique = [...new Set(taskIds)];
        if (unique.length === 0) return new Map();
        const placeholders = unique.map((_, i) => `$${i + 1}`).join(", ");
        const rows = await this.dataSource.query<readonly { id: string; title: string }[]>(
            `select id, title from tasks_current where id in (${placeholders})`,
            unique,
        );
        return new Map(rows.map((row) => [row.id, row.title] as const));
    }

    private async searchTasks(query: string, limit: number, userId: string): Promise<readonly unknown[]> {
        const pattern = `%${query.trim()}%`;
        const rows = await this.dataSource.query<readonly TaskRow[]>(
            `select id, title, workspace_path, status, updated_at
             from tasks_current
             where user_id = $1
               and (title ilike $2 or coalesce(workspace_path, '') ilike $2)
             order by updated_at desc
             limit $3`,
            [userId, pattern, limit],
        );
        return rows.map((row) => ({
            id: row.id,
            taskId: row.id,
            title: row.title,
            status: row.status,
            updatedAt: row.updated_at,
            ...(row.workspace_path ? { workspacePath: row.workspace_path } : {}),
        }));
    }
}
