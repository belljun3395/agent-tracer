import type { DaemonHealthEntity } from "@monitor/tracer-domain";
import type { DaemonHealthSnapshotDto } from "@monitor/kernel";

export function toDaemonHealthDto(entity: DaemonHealthEntity): DaemonHealthSnapshotDto {
    return {
        spoolBacklogBytes: entity.spoolBacklogBytes,
        deadLetterCount: entity.deadLetterCount,
        lastDeadReasons: entity.lastDeadReasons,
        swallowedErrors: entity.swallowedErrors,
        daemonVersion: entity.daemonVersion,
        retryStatusSince: entity.retryStatusSince ? entity.retryStatusSince.toISOString() : null,
        reportedAt: entity.reportedAt.toISOString(),
    };
}
