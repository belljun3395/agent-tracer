import type { TaskRepository } from "@monitor/tracer-domain";
import { clampInt } from "~ai-agent-worker/support/clamp.js";
import type { RecipeSlimEvent } from "~ai-agent-worker/domain/recipe/model/recipe.event.model.js";
import type { ProvenanceLedger } from "~ai-agent-worker/domain/recipe/model/recipe.provenance.model.js";
import {
    DEFAULT_SEARCH_LIMIT,
    DEFAULT_SIMILAR_TASK_LIMIT,
    MAX_SEARCH_LIMIT,
    MAX_SEARCH_OFFSET,
    MAX_SIMILAR_TASK_LIMIT,
} from "~ai-agent-worker/domain/recipe/model/recipe.tool.schema.js";

const EVENTS_INDEX = "events";
const TASKS_INDEX = "tasks";
const RECIPES_INDEX = "recipes";

/** recipe 슬라이스가 검색 엔진에 요구하는 표면이다. */
export interface RecipeSearchClient {
    search(request: { readonly index: string; readonly body: Record<string, unknown> }): Promise<unknown>;
}

export interface SlimTask {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly taskKind?: string;
    readonly updatedAt?: string;
}

export interface SlimRecipe {
    readonly id: string;
    readonly title: string;
    readonly intent: string;
    readonly status: string;
    readonly userEdited: boolean;
    readonly rev?: number;
    readonly updatedAt?: string;
}

export interface SearchEventsInput {
    readonly q: string;
    readonly taskId?: string;
    readonly kind?: string;
    readonly toolName?: string;
}

export interface SearchEventsPage {
    readonly events: readonly RecipeSlimEvent[];
    readonly truncated: boolean;
    readonly total: number;
}

interface SearchHit {
    readonly _id?: string;
    readonly _source?: Record<string, unknown>;
}

interface SearchResponseBody {
    readonly hits?: {
        readonly total?: number | { readonly value?: number };
        readonly hits?: readonly SearchHit[];
    };
}

export async function searchEvents(
    search: RecipeSearchClient,
    userId: string,
    input: SearchEventsInput,
    limit: number,
    offset: number,
    ledger: ProvenanceLedger,
): Promise<SearchEventsPage> {
    const filter: Record<string, unknown>[] = [{ term: { userId } }];
    if (input.taskId !== undefined) filter.push({ term: { taskId: input.taskId } });
    if (input.kind !== undefined) filter.push({ term: { kind: input.kind } });
    if (input.toolName !== undefined) filter.push({ term: { toolName: input.toolName } });
    const size = clampInt(limit, DEFAULT_SEARCH_LIMIT, 1, MAX_SEARCH_LIMIT);
    const from = clampInt(offset, 0, 0, MAX_SEARCH_OFFSET);

    const response = await search.search({
        index: EVENTS_INDEX,
        body: {
            size: size + 1,
            ...(from > 0 ? { from } : {}),
            track_total_hits: true,
            sort: [{ occurredAt: "desc" }],
            query: {
                bool: {
                    must: [{ multi_match: { query: input.q, fields: ["title", "body"] } }],
                    filter,
                },
            },
        },
    });

    const hits = searchHits(response);
    const truncated = hits.length > size;
    const page = truncated ? hits.slice(0, size) : hits;
    const events = page.map((hit) => toSlimEvent(hit._id ?? "", hit._source ?? {}));
    for (const [index, hit] of page.entries()) {
        const taskId = readString(hit._source?.["taskId"]);
        const event = events[index];
        if (taskId !== undefined && event !== undefined && event.id !== "") {
            ledger.recordEvents(taskId, [event]);
        }
    }
    return { events, truncated, total: searchTotal(response) ?? events.length };
}

export async function findSimilarTasks(
    search: RecipeSearchClient,
    userId: string,
    tasks: TaskRepository,
    anchorTaskId: string,
    limit: number,
): Promise<readonly SlimTask[] | null> {
    const anchor = await tasks.findById(anchorTaskId);
    if (anchor === null || anchor.userId !== userId) return null;
    const size = clampInt(limit, DEFAULT_SIMILAR_TASK_LIMIT, 1, MAX_SIMILAR_TASK_LIMIT);
    const response = await search.search({
        index: TASKS_INDEX,
        body: {
            size,
            query: {
                bool: {
                    must: [{ more_like_this: { fields: ["title"], like: anchor.title } }],
                    filter: [{ term: { userId } }],
                    must_not: [{ ids: { values: [anchorTaskId] } }],
                },
            },
        },
    });
    return searchHits(response).map((hit) => toSlimTask(hit._id ?? "", hit._source ?? {}));
}

export async function searchRecipes(
    search: RecipeSearchClient,
    userId: string,
    q: string,
    limit: number,
    ledger: ProvenanceLedger,
): Promise<readonly SlimRecipe[]> {
    const size = clampInt(limit, DEFAULT_SIMILAR_TASK_LIMIT, 1, MAX_SIMILAR_TASK_LIMIT);
    const response = await search.search({
        index: RECIPES_INDEX,
        body: {
            size,
            query: {
                bool: {
                    must: [{ more_like_this: { fields: ["title", "intent", "summaryMd"], like: q } }],
                    filter: [{ term: { userId } }],
                },
            },
        },
    });
    const results = searchHits(response).map((hit) => toSlimRecipe(hit._id ?? "", hit._source ?? {}));
    for (const result of results) {
        if (result.rev !== undefined) ledger.recordRecipe(result.id, result.rev);
    }
    return results;
}

function responseBody(response: unknown): SearchResponseBody {
    const candidate = typeof response === "object" && response !== null && "body" in response
        ? response.body
        : response;
    return candidate ?? {};
}

function searchHits(response: unknown): readonly SearchHit[] {
    return responseBody(response).hits?.hits ?? [];
}

function searchTotal(response: unknown): number | undefined {
    const total = responseBody(response).hits?.total;
    if (typeof total === "number") return total;
    if (typeof total === "object" && typeof total.value === "number") return total.value;
    return undefined;
}

function toSlimTask(id: string, source: Record<string, unknown>): SlimTask {
    const taskKind = readString(source["taskKind"]);
    const updatedAt = readString(source["updatedAt"]);
    return {
        id,
        title: readString(source["title"]) ?? "",
        status: readString(source["status"]) ?? "",
        ...(taskKind !== undefined ? { taskKind } : {}),
        ...(updatedAt !== undefined ? { updatedAt } : {}),
    };
}

function toSlimRecipe(id: string, source: Record<string, unknown>): SlimRecipe {
    const rev = readNumber(source["rev"]);
    const updatedAt = readString(source["updatedAt"]);
    return {
        id,
        title: readString(source["title"]) ?? "",
        intent: readString(source["intent"]) ?? "",
        status: readString(source["status"]) ?? "",
        userEdited: source["userEdited"] === true,
        ...(rev !== undefined ? { rev } : {}),
        ...(updatedAt !== undefined ? { updatedAt } : {}),
    };
}

// 검색 색인은 원장 레코드만 보고 만들어지고 turnId는 그 뒤 투영이 붙이므로 검색 결과에는 turn이 없다.
function toSlimEvent(id: string, source: Record<string, unknown>): RecipeSlimEvent {
    const body = readString(source["body"]);
    const toolName = readString(source["toolName"]);
    const seq = source["seq"];
    return {
        id,
        seq: readString(seq) ?? (typeof seq === "number" ? String(seq) : ""),
        kind: readString(source["kind"]) ?? "",
        title: readString(source["title"]) ?? "",
        ...(body !== undefined ? { body } : {}),
        ...(toolName !== undefined ? { toolName } : {}),
        filePaths: readStringArray(source["filePaths"]),
        occurredAt: readString(source["occurredAt"]) ?? "",
    };
}

function readString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === "string");
}
