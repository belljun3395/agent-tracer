import * as fs from "node:fs";
import * as path from "node:path";
import {fileURLToPath} from "node:url";
import {DAEMON_HEALTH_LAST_DEAD_REASONS_MAX, type DaemonHealthReportPayload} from "@monitor/kernel/daemon/daemon.health.const.js";
import {isRecord} from "~runtime/support/json.js";

// 플러그인 클론은 패키지 매니페스트 대신 플러그인 매니페스트에만 버전을 둔다.
const VERSION_MANIFEST_CANDIDATES = [
    "../../../package.json",
    "../../../.claude-plugin/plugin.json",
] as const;

export const UNKNOWN_DAEMON_VERSION = "unknown";

export function resolveDaemonVersion(
    baseDir: string = path.dirname(fileURLToPath(import.meta.url)),
): string {
    for (const candidate of VERSION_MANIFEST_CANDIDATES) {
        try {
            const parsed = JSON.parse(fs.readFileSync(path.join(baseDir, candidate), "utf8")) as unknown;
            const version = isRecord(parsed) && typeof parsed["version"] === "string"
                ? parsed["version"].trim()
                : "";
            if (version) return version;
        } catch {
            continue;
        }
    }
    return UNKNOWN_DAEMON_VERSION;
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
