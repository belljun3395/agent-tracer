import type {AgentTracerPaths} from "~runtime/config/home.paths.js";
import {listSpoolSegments, readSpoolSegment} from "~runtime/config/spool.js";
import type {IngestEvent} from "~runtime/domain/ingest/model/ingest.event.model.js";
import type {RecentEventRing} from "~runtime/domain/ingest/model/recent.event.model.js";
import type {SpoolHistory} from "~runtime/daemon/delivery/spool.sender.js";
import {isRecord} from "~runtime/support/json.js";

interface SpoolHistoryObserverOptions {
    readonly paths: AgentTracerPaths;
    readonly ring: RecentEventRing;
    readonly onEvent: (event: IngestEvent) => void;
    readonly recordSwallowedError: () => void;
}

/** 새로 닫힌 스풀 세그먼트를 최근 이벤트 링에 한 번씩만 반영한다. */
export class SpoolHistoryObserver implements SpoolHistory {
    readonly #options: SpoolHistoryObserverOptions;
    readonly #observed = new Set<string>();

    constructor(options: SpoolHistoryObserverOptions) {
        this.#options = options;
    }

    feed(): void {
        for (const segment of listSpoolSegments(this.#options.paths)) {
            if (this.#observed.has(segment.name)) continue;
            this.#observed.add(segment.name);
            for (const line of readSpoolSegment(segment.path)) this.#observe(line);
        }
    }

    forget(segmentNames: Iterable<string>): void {
        for (const name of segmentNames) this.#observed.delete(name);
    }

    #observe(line: string): void {
        try {
            const parsed = JSON.parse(line) as unknown;
            if (!isRecord(parsed) || typeof parsed["kind"] !== "string" || typeof parsed["taskId"] !== "string") {
                return;
            }
            const event = parsed as unknown as IngestEvent;
            this.#options.ring.observe(event);
            this.#options.onEvent(event);
        } catch {
            this.#options.recordSwallowedError();
        }
    }
}
