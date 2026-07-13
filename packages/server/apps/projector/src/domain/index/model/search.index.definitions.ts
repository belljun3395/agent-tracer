// OpenSearch alias가 가리키는 물리 인덱스 버전과 매핑의 단일 정의이며, 매핑을 바꿀 때는 index 버전만 올리면 된다.
export interface SearchIndexDefinition {
    readonly alias: string;
    readonly index: string;
    readonly settings: Record<string, unknown>;
    readonly mappings: Record<string, unknown>;
}

export const EVENTS_ALIAS = "events";
export const EVENTS_INDEX = "events-v1";
export const TASKS_ALIAS = "tasks";
export const TASKS_INDEX = "tasks-v1";
export const RECIPES_ALIAS = "recipes";
export const RECIPES_INDEX = "recipes-v1";

export const SEARCH_INDEX_DEFINITIONS: readonly SearchIndexDefinition[] = [
    {
        alias: EVENTS_ALIAS,
        index: EVENTS_INDEX,
        settings: { number_of_shards: 1, number_of_replicas: 0 },
        mappings: {
            properties: {
                userId: { type: "keyword" },
                taskId: { type: "keyword" },
                sessionId: { type: "keyword" },
                turnId: { type: "keyword" },
                kind: { type: "keyword" },
                lane: { type: "keyword" },
                title: { type: "text" },
                body: { type: "text" },
                toolName: { type: "keyword" },
                filePaths: { type: "keyword" },
                seq: { type: "long" },
                occurredAt: { type: "date" },
            },
        },
    },
    {
        alias: TASKS_ALIAS,
        index: TASKS_INDEX,
        settings: { number_of_shards: 1, number_of_replicas: 0 },
        mappings: {
            properties: {
                userId: { type: "keyword" },
                title: { type: "text", fields: { raw: { type: "keyword" } } },
                workspacePath: { type: "text", fields: { raw: { type: "keyword" } } },
                status: { type: "keyword" },
                origin: { type: "keyword" },
                taskKind: { type: "keyword" },
                archived: { type: "boolean" },
                hidden: { type: "boolean" },
                createdAt: { type: "date" },
                updatedAt: { type: "date" },
                lastEventAt: { type: "date" },
            },
        },
    },
    {
        alias: RECIPES_ALIAS,
        index: RECIPES_INDEX,
        settings: { number_of_shards: 1, number_of_replicas: 0 },
        mappings: {
            properties: {
                userId: { type: "keyword" },
                title: { type: "text" },
                intent: { type: "text" },
                description: { type: "text" },
                summaryMd: { type: "text" },
                touchedFiles: { type: "keyword" },
                status: { type: "keyword" },
                userEdited: { type: "boolean" },
                rev: { type: "integer" },
                updatedAt: { type: "date" },
            },
        },
    },
];
