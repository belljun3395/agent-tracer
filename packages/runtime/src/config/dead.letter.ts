import * as fs from "node:fs";
import {resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {appendSpoolLines} from "~runtime/config/spool.js";
import {isRecord} from "~runtime/support/json.js";

/** 서버가 영구 거부해 스풀에서 빠진 이벤트 한 줄이다. */
export interface DeadLetterEntry {
    readonly id: string;
    readonly kind: string;
    readonly taskId: string;
    readonly occurredAt: string;
    readonly line: string;
}

export interface DeadLetterReport {
    readonly count: number;
    readonly bytes: number;
    readonly byKind: Record<string, number>;
    readonly entries: readonly DeadLetterEntry[];
}

export interface DeadLetterFilter {
    readonly kinds?: readonly string[];
}

export interface DeadLetterMutation {
    readonly moved: number;
    readonly remaining: number;
}

function readLines(paths: AgentTracerPaths): string[] {
    try {
        return fs.readFileSync(paths.deadPath, "utf8")
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    } catch {
        return [];
    }
}

function parseEntry(line: string): DeadLetterEntry | null {
    try {
        const parsed: unknown = JSON.parse(line);
        if (!isRecord(parsed)) return null;
        return {
            id: typeof parsed["id"] === "string" ? parsed["id"] : "",
            kind: typeof parsed["kind"] === "string" ? parsed["kind"] : "unknown",
            taskId: typeof parsed["taskId"] === "string" ? parsed["taskId"] : "",
            occurredAt: typeof parsed["occurredAt"] === "string" ? parsed["occurredAt"] : "",
            line,
        };
    } catch {
        return null;
    }
}

function deadLetterBytes(paths: AgentTracerPaths): number {
    try {
        return fs.statSync(paths.deadPath).size;
    } catch {
        return 0;
    }
}

function writeDeadLetter(lines: readonly string[], paths: AgentTracerPaths): void {
    fs.writeFileSync(paths.deadPath, lines.map((line) => `${line}\n`).join(""));
}

export function readDeadLetter(
    limit: number,
    paths: AgentTracerPaths = resolveAgentTracerPaths(),
): DeadLetterReport {
    const lines = readLines(paths);
    const byKind: Record<string, number> = {};
    const parsed: DeadLetterEntry[] = [];
    for (const line of lines) {
        const entry = parseEntry(line);
        if (!entry) continue;
        byKind[entry.kind] = (byKind[entry.kind] ?? 0) + 1;
        parsed.push(entry);
    }
    return {
        count: lines.length,
        bytes: deadLetterBytes(paths),
        byKind,
        entries: parsed.slice(-limit).reverse(),
    };
}

export function requeueDeadLetter(
    filter: DeadLetterFilter,
    paths: AgentTracerPaths = resolveAgentTracerPaths(),
): DeadLetterMutation {
    const kinds = filter.kinds !== undefined ? new Set(filter.kinds) : undefined;
    const requeued: string[] = [];
    const kept: string[] = [];
    for (const line of readLines(paths)) {
        const entry = parseEntry(line);
        const selected = entry !== null && (kinds === undefined || kinds.has(entry.kind));
        if (selected) requeued.push(line);
        else kept.push(line);
    }
    if (requeued.length > 0) appendSpoolLines(requeued, paths);
    writeDeadLetter(kept, paths);
    return {moved: requeued.length, remaining: kept.length};
}

export function purgeDeadLetter(paths: AgentTracerPaths = resolveAgentTracerPaths()): DeadLetterMutation {
    const removed = readLines(paths).length;
    writeDeadLetter([], paths);
    return {moved: removed, remaining: 0};
}
