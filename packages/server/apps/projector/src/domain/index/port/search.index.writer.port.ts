import type { SearchIndexDefinition } from "~projector/domain/index/model/search.index.definitions.js";

export const SEARCH_INDEX_WRITER = Symbol("SearchIndexWriter");

/** 검색 벌크 쓰기 한 건의 애플리케이션 명령이다. */
export type SearchBulkOperation =
    | {
        readonly action: "index";
        readonly index: string;
        readonly id: string;
        readonly document: Record<string, unknown>;
    }
    | {
        readonly action: "update";
        readonly index: string;
        readonly id: string;
        readonly document: Record<string, unknown>;
        readonly upsert: boolean;
    };

/** 검색 인덱스에 문서를 쓰는 포트다. */
export interface SearchIndexWriterPort {
    ensureIndex(definition: SearchIndexDefinition, attachAlias: boolean): Promise<void>;
    writeBulk(operations: readonly SearchBulkOperation[]): Promise<{ readonly errors: boolean; readonly itemCount: number }>;
    indexDocument(index: string, id: string, document: Record<string, unknown>): Promise<void>;
    updateDocument(index: string, id: string, document: Record<string, unknown>): Promise<void>;
    /** 존재하지 않는 문서를 지워도 실패로 보지 않는다. */
    deleteDocument(index: string, id: string): Promise<void>;
}
