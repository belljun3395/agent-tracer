export const SEARCH_INDEX_RETENTION = Symbol("SearchIndexRetention");

/** 보존 기간이 지난 검색 문서를 지우는 포트다. */
export interface SearchIndexRetentionPort {
    deleteBefore(index: string, field: string, cutoff: Date): Promise<number>;
}
