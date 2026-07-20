export const INGEST_EVENT_LOG = Symbol("INGEST_EVENT_LOG");

/** 인제스트 경로의 관측 가능한 사건을 출력 기술과 분리해 기록한다. */
export interface IngestEventLog {
    rejected(entry: RejectedIngestLog): void;
    appended(entry: AppendedIngestLog): void;
    appendFailed(entry: AppendFailedIngestLog): void;
    allRejected(entry: AllRejectedIngestLog): void;
    contractVersionRejected(entry: ContractVersionRejectedLog): void;
    batchRejected(entry: BatchRejectedLog): void;
    rateLimited(entry: RateLimitedLog): void;
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

/** 원장 저장이 실패한 배치의 로그 표현이다. */
export interface AppendFailedIngestLog {
    readonly userId: string;
    readonly count: number;
    readonly error: string;
}

/** 배치의 모든 레코드가 개별 사유로 거부돼 원장에 아무것도 남지 않았을 때의 로그 표현이다. */
export interface AllRejectedIngestLog {
    readonly userId: string;
    readonly count: number;
}

/** 계약 버전 불일치로 배치 전체가 봉투 단계에서 거부됐을 때의 로그 표현이다. */
export interface ContractVersionRejectedLog {
    readonly contractVersion: string;
    readonly count: number | undefined;
}

/** 배치 봉투 자체가 스키마를 어겨 전체가 거부됐을 때의 로그 표현이다. */
export interface BatchRejectedLog {
    readonly reason: string;
    readonly count: number | undefined;
}

/** 429로 거부된 요청의 로그 표현이다. */
export interface RateLimitedLog {
    readonly userId: string;
    readonly capacity: number;
    readonly refillPerSec: number;
    readonly retryAfterMs: number;
}
