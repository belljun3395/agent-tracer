// 데몬의 집계와 서버의 검증이 함께 쓰는 dead-letter 사유 링버퍼의 크기다.
export const DAEMON_HEALTH_LAST_DEAD_REASONS_MAX = 10;

/** 로컬 데몬이 유휴 틱마다 보고하는 자기 건강 스냅샷의 모양이다. */
export interface DaemonHealthReportPayload {
    readonly spoolBacklogBytes: number;
    readonly deadLetterCount: number;
    readonly lastDeadReasons: readonly string[];
    readonly swallowedErrors: number;
    readonly daemonVersion: string;
    readonly retryStatusSince: number | null;
}
