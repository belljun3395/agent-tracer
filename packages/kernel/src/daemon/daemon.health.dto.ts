// reportedAt으로 서버 중단 뒤 보고가 끊긴 stale 상태를 판별한다.
export interface DaemonHealthSnapshotDto {
    readonly spoolBacklogBytes: number;
    readonly deadLetterCount: number;
    readonly lastDeadReasons: readonly string[];
    readonly swallowedErrors: number;
    readonly daemonVersion: string;
    readonly retryStatusSince: string | null;
    readonly reportedAt: string;
}
