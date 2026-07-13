export const INGEST_EVENT_LOG = Symbol("INGEST_EVENT_LOG");

/** 인제스트 결과를 출력 기술과 분리해 기록한다. */
export interface IngestEventLog {
    rejected(entry: RejectedIngestLog): void;
    appended(entry: AppendedIngestLog): void;
}

/** 거부된 인제스트 이벤트의 로그 표현이다. */
export interface RejectedIngestLog {
    readonly userId: string;
    readonly eventId: string;
    readonly reason: string;
}

/** 저장된 인제스트 배치의 로그 표현이다. */
export interface AppendedIngestLog {
    readonly userId: string;
    readonly count: number;
    readonly taskIds: readonly string[];
    readonly eventIds: readonly string[];
}
