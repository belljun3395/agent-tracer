import * as path from "node:path";
import {resolveProjectDir} from "~runtime/config/env.js";
import {readJsonFile, writeJsonFile} from "~runtime/support/json.file.store.js";
import type {ToolTimingPort} from "~runtime/domain/ingest/port/tool.timing.port.js";

const PRUNE_AGE_MS = 6 * 60 * 60 * 1000;

interface ToolTimingFile {
    readonly starts: Record<string, number>;
}

function isToolTimingFile(value: unknown): value is ToolTimingFile {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const starts = (value as Record<string, unknown>)["starts"];
    if (typeof starts !== "object" || starts === null || Array.isArray(starts)) return false;
    return Object.values(starts as Record<string, unknown>).every((entry) => typeof entry === "number");
}

/** 도구 호출 시작 시각을 프로젝트의 `.claude/.tool-timing`에 세션별 파일로 둔다. */
export class FileToolTimingAdapter implements ToolTimingPort {
    constructor(private readonly projectDir: string = resolveProjectDir()) {}

    markStart(sessionId: string, toolUseId: string, startedAtMs: number): void {
        const starts = {...this.load(sessionId), [toolUseId]: startedAtMs};
        this.save(sessionId, prune(starts, startedAtMs));
    }

    takeStart(sessionId: string, toolUseId: string): number | undefined {
        const starts = this.load(sessionId);
        const startedAtMs = starts[toolUseId];
        if (startedAtMs === undefined) return undefined;
        const {[toolUseId]: _removed, ...rest} = starts;
        this.save(sessionId, rest);
        return startedAtMs;
    }

    private load(sessionId: string): Record<string, number> {
        return readJsonFile(this.pathOf(sessionId), isToolTimingFile)?.starts ?? {};
    }

    private save(sessionId: string, starts: Record<string, number>): void {
        writeJsonFile(this.pathOf(sessionId), {starts});
    }

    private pathOf(sessionId: string): string {
        return path.join(this.projectDir, ".claude", ".tool-timing", `${sessionId}.json`);
    }
}

function prune(starts: Record<string, number>, nowMs: number): Record<string, number> {
    return Object.fromEntries(
        Object.entries(starts).filter(([, startedAtMs]) => nowMs - startedAtMs < PRUNE_AGE_MS),
    );
}
