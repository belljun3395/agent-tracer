import type {AgentTracerPaths} from "~runtime/config/home.paths.js";
import {
    listSpoolSegments,
    readSpoolSegment,
    SPOOL_BATCH_MAX,
    type SpoolSegment,
} from "~runtime/config/spool.js";
import {isRecord} from "~runtime/support/json.js";

/** 한 번의 전송으로 묶인 세그먼트와 그 안의 이벤트 줄이다. */
export interface SpoolBatch {
    readonly segments: readonly SpoolSegment[];
    readonly lines: readonly string[];
}

/** 정렬된 닫힌 세그먼트를 인제스트 배치 상한까지 묶는다. */
export function collectSpoolBatch(paths: AgentTracerPaths, segmentLimit: number): SpoolBatch | null {
    const all = listSpoolSegments(paths);
    if (all.length === 0) return null;
    const segments: SpoolSegment[] = [];
    const lines: string[] = [];
    for (const segment of all) {
        if (segments.length >= segmentLimit) break;
        const segmentLines = readSpoolSegment(segment.path);
        if (segments.length > 0 && lines.length + segmentLines.length > SPOOL_BATCH_MAX) break;
        segments.push(segment);
        lines.push(...segmentLines);
        if (lines.length >= SPOOL_BATCH_MAX) break;
    }
    return segments.length > 0 ? {segments, lines} : null;
}

export function eventIdOfSpoolLine(line: string): string | null {
    try {
        const parsed: unknown = JSON.parse(line);
        return isRecord(parsed) && typeof parsed["id"] === "string" ? parsed["id"] : null;
    } catch {
        return null;
    }
}
