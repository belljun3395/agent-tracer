/** 멱등 보증 윈도를 지난 수집 키를 원장에서 지운다. */
export interface IngestKeyRetentionPort {
    deleteExpiredIngestKeys(): Promise<number>;
}
