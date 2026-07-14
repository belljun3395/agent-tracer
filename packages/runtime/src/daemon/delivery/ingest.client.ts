import type {DaemonHealthReportPayload} from "@monitor/kernel/daemon/daemon.health.const.js";
import {monitorUserHeaders, resolveMonitorIdentity} from "~runtime/config/monitor.identity.js";
import {
    classifyIngestStatus,
    MAX_INGEST_BACKOFF_MS,
    parseRetryAfterMs,
} from "~runtime/daemon/delivery/ingest.retry.js";
import {INGEST_EVENTS_ENDPOINT} from "~runtime/domain/ingest/model/ingest.event.model.js";
import {isRecord} from "~runtime/support/json.js";

const SEND_TIMEOUT_MS = 5000;
const DAEMON_HEALTH_ENDPOINT = "/api/v1/daemon-health";

export type IngestSendResult =
    | {readonly outcome: "ok"; readonly rejectedIds: readonly string[]}
    | {readonly outcome: "dead"; readonly reason: string}
    | {readonly outcome: "server-error"}
    | {readonly outcome: "retry"; readonly retryAfterMs: number | null}
    | {readonly outcome: "unreachable"};

/** 스풀에 적힌 이벤트 줄을 다시 파싱하지 않고 그대로 인제스트 배치 본문에 이어 붙인다. */
export async function sendIngestBatch(
    lines: readonly string[],
    daemonVersion: string,
): Promise<IngestSendResult> {
    const body = `{"contractVersion":${JSON.stringify(daemonVersion)},"events":[${lines.join(",")}]}`;
    const identity = resolveMonitorIdentity();
    try {
        const response = await fetch(`${identity.baseUrl}${INGEST_EVENTS_ENDPOINT}`, {
            method: "POST",
            headers: {"Content-Type": "application/json", ...monitorUserHeaders(identity)},
            body,
            signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
        switch (classifyIngestStatus(response.status)) {
            case "ok":
                return {outcome: "ok", rejectedIds: await readRejectedIds(response)};
            case "dead":
                return {outcome: "dead", reason: await readErrorReason(response)};
            case "retry":
                return {
                    outcome: "retry",
                    retryAfterMs: parseRetryAfterMs(
                        response.headers.get("retry-after"),
                        MAX_INGEST_BACKOFF_MS,
                    ),
                };
            case "server-error":
                return {outcome: "server-error"};
        }
    } catch {
        return {outcome: "unreachable"};
    }
}

/** 데몬의 현재 전송 건강 상태를 서버에 보고한다. */
export async function sendDaemonHealth(payload: DaemonHealthReportPayload): Promise<void> {
    const identity = resolveMonitorIdentity();
    try {
        await fetch(`${identity.baseUrl}${DAEMON_HEALTH_ENDPOINT}`, {
            method: "POST",
            headers: {"Content-Type": "application/json", ...monitorUserHeaders(identity)},
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
    } catch {
        return;
    }
}

async function readRejectedIds(response: Response): Promise<readonly string[]> {
    try {
        const parsed: unknown = await response.json();
        if (!isRecord(parsed) || !Array.isArray(parsed["rejected"])) return [];
        return parsed["rejected"]
            .map((entry) => (isRecord(entry) && typeof entry["id"] === "string" ? entry["id"] : null))
            .filter((id): id is string => id !== null);
    } catch {
        return [];
    }
}

async function readErrorReason(response: Response): Promise<string> {
    try {
        const parsed: unknown = await response.json();
        if (isRecord(parsed) && isRecord(parsed["error"]) && typeof parsed["error"]["message"] === "string") {
            return parsed["error"]["message"];
        }
    } catch {
        return "rejected 4xx";
    }
    return "rejected 4xx";
}
