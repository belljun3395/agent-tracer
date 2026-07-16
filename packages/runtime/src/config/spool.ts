import * as fs from "node:fs";
import * as path from "node:path";
import {ensureSpoolDir, resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {generateUlid} from "~runtime/support/ulid.js";

export const SPOOL_MAX_BYTES = 50 * 1024 * 1024;
export const SPOOL_BATCH_MAX = 100;

const SEGMENT_PREFIX = "seg-";
const SEGMENT_SUFFIX = ".jsonl";
const TMP_PREFIX = ".tmp-";

/** 스풀에 쌓인 닫힌 세그먼트 파일 하나다. */
export interface SpoolSegment {
    readonly path: string;
    readonly name: string;
    readonly size: number;
}

export function appendSpoolLines(
    lines: readonly string[],
    paths: AgentTracerPaths = resolveAgentTracerPaths(),
    segmentId: string = generateUlid(),
): void {
    if (lines.length === 0) return;
    ensureSpoolDir(paths);
    const payload = lines.map((line) => `${line}\n`).join("");
    const tmpPath = path.join(paths.spoolDir, `${TMP_PREFIX}${segmentId}${SEGMENT_SUFFIX}`);
    const finalPath = path.join(paths.spoolDir, `${SEGMENT_PREFIX}${segmentId}${SEGMENT_SUFFIX}`);
    const fd = fs.openSync(tmpPath, "w");
    try {
        fs.writeSync(fd, payload);
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
    fs.renameSync(tmpPath, finalPath);
}

export function listSpoolSegments(paths: AgentTracerPaths = resolveAgentTracerPaths()): SpoolSegment[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(paths.spoolDir);
    } catch {
        return [];
    }
    const names = entries
        .filter((name) => name.startsWith(SEGMENT_PREFIX) && name.endsWith(SEGMENT_SUFFIX))
        .sort();
    const segments: SpoolSegment[] = [];
    for (const name of names) {
        const full = path.join(paths.spoolDir, name);
        try {
            segments.push({path: full, name, size: fs.statSync(full).size});
        } catch {
            continue;
        }
    }
    return segments;
}

export function spoolBacklogBytes(paths: AgentTracerPaths = resolveAgentTracerPaths()): number {
    return listSpoolSegments(paths).reduce((sum, segment) => sum + segment.size, 0);
}

export function readSpoolSegment(segmentPath: string): string[] {
    let content: string;
    try {
        content = fs.readFileSync(segmentPath, "utf8");
    } catch {
        return [];
    }
    return content.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
}

export function readAllSpoolLines(paths: AgentTracerPaths = resolveAgentTracerPaths()): string[] {
    return listSpoolSegments(paths).flatMap((segment) => readSpoolSegment(segment.path));
}

export function removeSpoolSegment(segmentPath: string): void {
    try {
        fs.unlinkSync(segmentPath);
    } catch {
        return;
    }
}

export function appendDeadLetter(
    lines: readonly string[],
    paths: AgentTracerPaths = resolveAgentTracerPaths(),
): void {
    if (lines.length === 0) return;
    ensureSpoolDir(paths);
    fs.appendFileSync(paths.deadPath, lines.map((line) => `${line}\n`).join(""));
}

/** 상한을 넘겨 버린 세그먼트의 이름과 바이트 수다. */
export interface SpoolCapResult {
    readonly droppedBytes: number;
    readonly droppedSegments: readonly string[];
}

export function enforceSpoolSizeCap(
    paths: AgentTracerPaths = resolveAgentTracerPaths(),
    maxBytes: number = SPOOL_MAX_BYTES,
): SpoolCapResult {
    const segments = listSpoolSegments(paths);
    let total = segments.reduce((sum, segment) => sum + segment.size, 0);
    const droppedSegments: string[] = [];
    let droppedBytes = 0;
    for (const segment of segments) {
        if (total <= maxBytes) break;
        removeSpoolSegment(segment.path);
        total -= segment.size;
        droppedBytes += segment.size;
        droppedSegments.push(segment.name);
    }
    return {droppedBytes, droppedSegments};
}
