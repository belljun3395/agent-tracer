import * as fs from "node:fs";
import * as path from "node:path";
import {ensureSpoolDir, resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {generateUlid} from "~runtime/support/ulid.js";

export const SPOOL_MAX_BYTES = 50 * 1024 * 1024;
export const SPOOL_BATCH_MAX = 100;

const SEGMENT_PREFIX = "seg-";
const SEGMENT_SUFFIX = ".jsonl";
const TMP_PREFIX = ".tmp-";
const SPOOL_LOG_PREFIX = "[spool]";

/** 스풀에 쌓인 닫힌 세그먼트 파일 하나다. */
export interface SpoolSegment {
    readonly path: string;
    readonly name: string;
    readonly size: number;
}

// 세그먼트는 이름 순으로 배달되므로 쪼갠 조각은 0을 채운 번호로 순서를 지킨다.
function chunkSegmentId(segmentId: string, index: number): string {
    return `${segmentId}-${String(index).padStart(3, "0")}`;
}

function writeSegment(lines: readonly string[], paths: AgentTracerPaths, segmentId: string): void {
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

/** 상한을 넘긴 세그먼트는 서버가 배치로 받지 못하므로 상한 이하로 쪼개 쓴다. */
export function appendSpoolLines(
    lines: readonly string[],
    paths: AgentTracerPaths = resolveAgentTracerPaths(),
    segmentId: string = generateUlid(),
): void {
    if (lines.length === 0) return;
    ensureSpoolDir(paths);
    if (lines.length <= SPOOL_BATCH_MAX) {
        writeSegment(lines, paths, segmentId);
        return;
    }
    for (let offset = 0, index = 0; offset < lines.length; offset += SPOOL_BATCH_MAX, index += 1) {
        writeSegment(lines.slice(offset, offset + SPOOL_BATCH_MAX), paths, chunkSegmentId(segmentId, index));
    }
}

export function listSpoolSegments(paths: AgentTracerPaths = resolveAgentTracerPaths()): SpoolSegment[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(paths.spoolDir);
    } catch (error) {
        // 디렉터리가 아직 없는 것은 정상이고, 그 밖의 실패는 backlog를 0으로 오보한다.
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            process.stderr.write(`${SPOOL_LOG_PREFIX} failed to list ${paths.spoolDir}: ${String(error)}\n`);
        }
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

/** 상한이 생기기 전에 쌓여 배달될 수 없는 세그먼트를 상한 이하 조각으로 다시 쓴다. */
export function splitOversizedSegments(paths: AgentTracerPaths = resolveAgentTracerPaths()): number {
    let split = 0;
    for (const segment of listSpoolSegments(paths)) {
        const lines = readSpoolSegment(segment.path);
        if (lines.length <= SPOOL_BATCH_MAX) continue;
        const baseId = segment.name.slice(SEGMENT_PREFIX.length, -SEGMENT_SUFFIX.length);
        for (let offset = 0, index = 0; offset < lines.length; offset += SPOOL_BATCH_MAX, index += 1) {
            writeSegment(lines.slice(offset, offset + SPOOL_BATCH_MAX), paths, chunkSegmentId(baseId, index));
        }
        removeSpoolSegment(segment.path);
        split += 1;
    }
    return split;
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
