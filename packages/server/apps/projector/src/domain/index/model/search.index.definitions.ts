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
export const MEMOS_ALIAS = "memos";
export const MEMOS_INDEX = "memos-v1";

// standard analyzer는 한글 음절 뭉치를 토큰 하나로 색인해 "입력"으로 "입력값"을 못 찾으므로 2글자 ngram으로 색인·질의한다.
const SUBSTRING_ANALYSIS = {
    analyzer: {
        substring: { type: "custom", tokenizer: "substring_bigram", filter: ["lowercase"] },
    },
    tokenizer: {
        substring_bigram: { type: "ngram", min_gram: 2, max_gram: 2, token_chars: ["letter", "digit"] },
    },
};

const BASE_SETTINGS = { number_of_shards: 1, number_of_replicas: 0, analysis: SUBSTRING_ANALYSIS };
const TEXT = { type: "text", analyzer: "substring" };
const TEXT_WITH_RAW = { type: "text", analyzer: "substring", fields: { raw: { type: "keyword" } } };

export const SEARCH_INDEX_DEFINITIONS: readonly SearchIndexDefinition[] = [
    {
        alias: EVENTS_ALIAS,
        index: EVENTS_INDEX,
        settings: BASE_SETTINGS,
        mappings: {
            properties: {
                userId: { type: "keyword" },
                taskId: { type: "keyword" },
                sessionId: { type: "keyword" },
                turnId: { type: "keyword" },
                kind: { type: "keyword" },
                lane: { type: "keyword" },
                title: TEXT,
                body: TEXT,
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
        settings: BASE_SETTINGS,
        mappings: {
            properties: {
                userId: { type: "keyword" },
                title: TEXT_WITH_RAW,
                workspacePath: TEXT_WITH_RAW,
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
        settings: BASE_SETTINGS,
        mappings: {
            properties: {
                userId: { type: "keyword" },
                title: TEXT,
                intent: TEXT,
                description: TEXT,
                summaryMd: TEXT,
                touchedFiles: { type: "keyword" },
                status: { type: "keyword" },
                userEdited: { type: "boolean" },
                rev: { type: "integer" },
                updatedAt: { type: "date" },
            },
        },
    },
    {
        alias: MEMOS_ALIAS,
        index: MEMOS_INDEX,
        settings: BASE_SETTINGS,
        mappings: {
            properties: {
                userId: { type: "keyword" },
                taskId: { type: "keyword" },
                eventId: { type: "keyword" },
                author: { type: "keyword" },
                body: TEXT,
                updatedAt: { type: "date" },
            },
        },
    },
];
