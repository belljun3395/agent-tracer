import type {AgentTracerPaths} from "~runtime/config/home.paths.js";
import {
    appendDeadLetter,
    enforceSpoolSizeCap,
    listSpoolSegments,
    removeSpoolSegment,
    spoolBacklogBytes,
    type SpoolSegment,
} from "~runtime/config/spool.js";
import {daemonLog} from "~runtime/daemon/daemon.log.js";
import {sendDaemonHealth, sendIngestBatch} from "~runtime/daemon/delivery/ingest.client.js";
import {MAX_INGEST_BACKOFF_MS, type SendOutcome} from "~runtime/daemon/delivery/ingest.retry.js";
import {collectSpoolBatch, eventIdOfSpoolLine, type SpoolBatch} from "~runtime/daemon/delivery/spool.batch.js";
import type {DaemonHealthTracker} from "~runtime/daemon/lifecycle/daemon.health.js";
import {ownsDaemonPid} from "~runtime/daemon/lifecycle/daemon.pid.js";

const FLUSH_IDLE_MS = 1000;
const INITIAL_BACKOFF_MS = 1000;
const SEGMENT_BATCH_MAX = 50;
const FINAL_FLUSH_MAX_ITERATIONS = 2000;
const HEALTH_REPORT_MIN_INTERVAL_MS = 60_000;

/** 제어 화면이 읽는 전송기의 현재 상태다. */
export interface SpoolSenderState {
    readonly backoffMs: number;
    readonly retryStatusSince: number | null;
    readonly lastSendAt: number | null;
    readonly lastSendOutcome: SendOutcome | null;
    readonly lastDeadReason: string | null;
    readonly poisonSegment: string | null;
    readonly poisonAttempts: number;
    readonly poisonThreshold: number;
}

/** 보낸 세그먼트를 최근 이벤트 이력에서 지우는 관찰자의 계약이다. */
export interface SpoolHistory {
    feed(): void;
    forget(segmentNames: Iterable<string>): void;
}

interface SpoolSenderOptions {
    readonly paths: AgentTracerPaths;
    readonly history: SpoolHistory;
    readonly health: DaemonHealthTracker;
    readonly daemonVersion: string;
    readonly spoolMaxBytes: number;
    readonly poisonAttempts: number;
    readonly onActivity: () => void;
    readonly onOwnershipLost: () => void;
}

/** 닫힌 스풀 세그먼트를 인제스트 API로 보내고 재시도와 독약 세그먼트 격리를 관리한다. */
export class SpoolSender {
    readonly #options: SpoolSenderOptions;
    #backoffMs = 0;
    #retryStatusSince: number | null = null;
    #lastHealthReportAt = 0;
    #lastSendAt: number | null = null;
    #lastSendOutcome: SendOutcome | null = null;
    #lastDeadReason: string | null = null;
    #flushTimer: NodeJS.Timeout | undefined;
    #segmentBatchLimit = SEGMENT_BATCH_MAX;
    #poisonSegment: string | null = null;
    #poisonAttempts = 0;
    #stopped = false;

    constructor(options: SpoolSenderOptions) {
        this.#options = options;
    }

    start(): void {
        this.#scheduleFlush(0);
    }

    stop(): void {
        this.#stopped = true;
        if (this.#flushTimer) clearTimeout(this.#flushTimer);
    }

    feedHistory(): void {
        this.#options.history.feed();
    }

    flushNow(): void {
        if (this.#flushTimer) clearTimeout(this.#flushTimer);
        this.#backoffMs = 0;
        this.#scheduleFlush(0);
    }

    resetBackoff(): void {
        this.#backoffMs = 0;
        this.#retryStatusSince = null;
        this.#resetPoisonState();
        if (this.#flushTimer) clearTimeout(this.#flushTimer);
        this.#scheduleFlush(0);
    }

    hasPendingSegments(): boolean {
        return listSpoolSegments(this.#options.paths).length > 0;
    }

    isBackingOff(): boolean {
        return this.#backoffMs > 0;
    }

    state(): SpoolSenderState {
        return {
            backoffMs: this.#backoffMs,
            retryStatusSince: this.#retryStatusSince,
            lastSendAt: this.#lastSendAt,
            lastSendOutcome: this.#lastSendOutcome,
            lastDeadReason: this.#lastDeadReason,
            poisonSegment: this.#poisonSegment,
            poisonAttempts: this.#poisonAttempts,
            poisonThreshold: this.#options.poisonAttempts,
        };
    }

    /** 종료 직전에 남은 세그먼트를 보내며 서버가 받지 못하면 다음 기동에 넘긴다. */
    async finalFlush(): Promise<void> {
        for (let iteration = 0; iteration < FINAL_FLUSH_MAX_ITERATIONS; iteration += 1) {
            const batch = collectSpoolBatch(this.#options.paths, SEGMENT_BATCH_MAX);
            if (!batch) break;
            const result = await sendIngestBatch(batch.lines, this.#options.daemonVersion);
            if (result.outcome !== "ok" && result.outcome !== "dead") break;
            if (result.outcome === "dead") appendDeadLetter(batch.lines, this.#options.paths);
            else this.#parkRejected(batch, result.rejectedIds, "rejected by id");
            this.#removeSegments(batch.segments);
        }
    }

    #scheduleFlush(delayMs: number): void {
        if (this.#stopped) return;
        this.#flushTimer = setTimeout(() => void this.#flushTick(), delayMs);
        this.#flushTimer.unref();
    }

    async #flushTick(): Promise<void> {
        if (this.#stopped) return;
        if (!ownsDaemonPid(this.#options.paths)) {
            daemonLog("socket ownership lost — exiting");
            this.#options.onOwnershipLost();
            return;
        }
        try {
            this.#enforceCap();
            this.feedHistory();
            const batch = collectSpoolBatch(this.#options.paths, this.#segmentBatchLimit);
            if (!batch) {
                void this.#reportHealth();
                this.#scheduleFlush(FLUSH_IDLE_MS);
                return;
            }
            this.#options.onActivity();
            await this.#sendBatch(batch);
        } catch (error) {
            daemonLog(`flush error: ${String(error)}`);
            this.#options.health.recordSwallowedError();
            this.#scheduleFlush(FLUSH_IDLE_MS);
        }
    }

    async #sendBatch(batch: SpoolBatch): Promise<void> {
        const result = await sendIngestBatch(batch.lines, this.#options.daemonVersion);
        this.#lastSendAt = Date.now();
        this.#lastSendOutcome = result.outcome;

        if (result.outcome === "unreachable") {
            this.#increaseBackoff();
            this.#scheduleFlush(this.#backoffMs);
            return;
        }
        if (result.outcome === "retry") {
            this.#retryStatusSince ??= Date.now();
            this.#increaseBackoff();
            this.#scheduleFlush(result.retryAfterMs ?? this.#backoffMs);
            return;
        }
        this.#retryStatusSince = null;

        if (result.outcome === "server-error") {
            this.#handleServerError(batch);
            return;
        }
        if (result.outcome === "dead") {
            this.#lastDeadReason = result.reason;
            appendDeadLetter(batch.lines, this.#options.paths);
            this.#options.health.recordDeadLetter(result.reason, batch.lines.length);
            daemonLog(`batch rejected (${result.reason}) — ${batch.lines.length} event(s) to dead-letter`);
        } else {
            this.#parkRejected(batch, result.rejectedIds, "rejected by id");
        }
        this.#removeSegments(batch.segments);
        this.#resetPoisonState();
        this.#backoffMs = 0;
        this.#scheduleFlush(0);
    }

    #parkRejected(batch: SpoolBatch, rejectedIds: readonly string[], reason: string): void {
        if (rejectedIds.length === 0) return;
        const rejected = new Set(rejectedIds);
        appendDeadLetter(
            batch.lines.filter((line) => rejected.has(eventIdOfSpoolLine(line) ?? "")),
            this.#options.paths,
        );
        this.#options.health.recordDeadLetter(reason, rejected.size);
        daemonLog(`${rejected.size} event(s) rejected — moved to dead-letter`);
    }

    #handleServerError(batch: SpoolBatch): void {
        const first = batch.segments[0]?.name ?? "";
        if (this.#poisonSegment !== first) {
            this.#poisonSegment = first;
            this.#poisonAttempts = 0;
        }
        this.#poisonAttempts += 1;
        if (this.#poisonAttempts < this.#options.poisonAttempts) {
            this.#increaseBackoff();
            this.#scheduleFlush(this.#backoffMs);
            return;
        }
        if (batch.segments.length > 1) {
            this.#segmentBatchLimit = Math.max(1, Math.floor(batch.segments.length / 2));
            this.#poisonAttempts = 0;
            this.#backoffMs = 0;
            this.#scheduleFlush(0);
            return;
        }
        appendDeadLetter(batch.lines, this.#options.paths);
        this.#options.health.recordDeadLetter(
            `poison after ${this.#options.poisonAttempts} server errors`,
            batch.lines.length,
        );
        daemonLog(`poison segment parked after ${this.#options.poisonAttempts} server errors`);
        this.#removeSegments(batch.segments);
        this.#resetPoisonState();
        this.#backoffMs = 0;
        this.#scheduleFlush(0);
    }

    #increaseBackoff(): void {
        this.#backoffMs = this.#backoffMs === 0
            ? INITIAL_BACKOFF_MS
            : Math.min(this.#backoffMs * 2, MAX_INGEST_BACKOFF_MS);
    }

    #enforceCap(): void {
        const cap = enforceSpoolSizeCap(this.#options.paths, this.#options.spoolMaxBytes);
        if (cap.droppedSegments.length === 0) return;
        this.#options.history.forget(cap.droppedSegments);
        daemonLog(`spool over cap — dropped ${cap.droppedSegments.length} segment(s), ${cap.droppedBytes} byte(s)`);
    }

    #removeSegments(segments: readonly SpoolSegment[]): void {
        for (const segment of segments) removeSpoolSegment(segment.path);
        this.#options.history.forget(segments.map((segment) => segment.name));
    }

    #resetPoisonState(): void {
        this.#segmentBatchLimit = SEGMENT_BATCH_MAX;
        this.#poisonSegment = null;
        this.#poisonAttempts = 0;
    }

    async #reportHealth(): Promise<void> {
        const now = Date.now();
        if (now - this.#lastHealthReportAt < HEALTH_REPORT_MIN_INTERVAL_MS) return;
        this.#lastHealthReportAt = now;
        await sendDaemonHealth(this.#options.health.snapshot({
            spoolBacklogBytes: spoolBacklogBytes(this.#options.paths),
            daemonVersion: this.#options.daemonVersion,
            retryStatusSince: this.#retryStatusSince,
        }));
    }
}
