import {DAEMON_HEALTH_LAST_DEAD_REASONS_MAX, type DaemonHealthReportPayload} from "@monitor/kernel/daemon/daemon.health.const.js";
import {readRuntimeManifestVersion, resolveRuntimeRoot} from "~runtime/config/runtime.root.js";

export const UNKNOWN_DAEMON_VERSION = "unknown";

/** 훅과 데몬이 같은 매니페스트를 읽어야 버전 비교가 성립한다. */
export function resolveDaemonVersion(root: string = resolveRuntimeRoot()): string {
    return readRuntimeManifestVersion(root) || UNKNOWN_DAEMON_VERSION;
}

/** 이번 데몬 프로세스 수명 동안의 dead-letter 건수와 삼킨 오류를 인메모리로 집계한다. */
export class DaemonHealthTracker {
    private deadLetterCount = 0;
    private swallowedErrors = 0;
    private readonly lastDeadReasons: string[] = [];

    recordDeadLetter(reason: string, count: number): void {
        if (count <= 0) return;
        this.deadLetterCount += count;
        this.lastDeadReasons.push(reason);
        if (this.lastDeadReasons.length > DAEMON_HEALTH_LAST_DEAD_REASONS_MAX) this.lastDeadReasons.shift();
    }

    recordSwallowedError(): void {
        this.swallowedErrors += 1;
    }

    get swallowedErrorCount(): number {
        return this.swallowedErrors;
    }

    snapshot(params: {
        readonly spoolBacklogBytes: number;
        readonly daemonVersion: string;
        readonly retryStatusSince: number | null;
    }): DaemonHealthReportPayload {
        return {
            spoolBacklogBytes: params.spoolBacklogBytes,
            deadLetterCount: this.deadLetterCount,
            lastDeadReasons: [...this.lastDeadReasons],
            swallowedErrors: this.swallowedErrors,
            daemonVersion: params.daemonVersion,
            retryStatusSince: params.retryStatusSince,
        };
    }
}
