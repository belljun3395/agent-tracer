import { Column, Entity, PrimaryColumn } from "typeorm";

// 사용자별 로컬 데몬 자기 건강 최신 스냅샷 1행이며 userId가 자연키다.
@Entity({ name: "daemon_health" })
export class DaemonHealthEntity {
    @PrimaryColumn({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "spool_backlog_bytes", type: "integer" })
    spoolBacklogBytes!: number;

    @Column({ name: "dead_letter_count", type: "integer" })
    deadLetterCount!: number;

    @Column({ name: "last_dead_reasons", type: "jsonb", default: [] })
    lastDeadReasons!: string[];

    @Column({ name: "swallowed_errors", type: "integer" })
    swallowedErrors!: number;

    @Column({ name: "daemon_version", type: "text" })
    daemonVersion!: string;

    @Column({ name: "retry_status_since", type: "timestamptz", nullable: true })
    retryStatusSince!: Date | null;

    @Column({ name: "reported_at", type: "timestamptz" })
    reportedAt!: Date;

    static fromReport(
        userId: string,
        report: {
            readonly spoolBacklogBytes: number;
            readonly deadLetterCount: number;
            readonly lastDeadReasons: readonly string[];
            readonly swallowedErrors: number;
            readonly daemonVersion: string;
            readonly retryStatusSince: number | null;
        },
        now: Date,
    ): DaemonHealthEntity {
        const entity = new DaemonHealthEntity();
        entity.userId = userId;
        entity.spoolBacklogBytes = report.spoolBacklogBytes;
        entity.deadLetterCount = report.deadLetterCount;
        entity.lastDeadReasons = [...report.lastDeadReasons];
        entity.swallowedErrors = report.swallowedErrors;
        entity.daemonVersion = report.daemonVersion;
        entity.retryStatusSince = report.retryStatusSince !== null ? new Date(report.retryStatusSince) : null;
        entity.reportedAt = now;
        return entity;
    }
}
