import * as path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PROJECT_DIR } from "./paths.const.js";
import { isRecord, toTrimmedString } from "./utils.js";

const SESSION_STATE_DIR = "agent-tracer";
const SESSION_STATE_FILE = "latest-session.json";
const OBSERVER_STATE_FILE = "observer.json";

export interface CodexLatestSessionState {
    readonly sessionId: string;
    readonly modelId?: string;
    readonly updatedAt: string;
    readonly source?: string;
}

export interface CodexObserverState {
    readonly pid: number;
    readonly sessionId?: string;
    readonly startedAt: string;
}

/**
 * Writes the latest-session hint file to
 * `<projectDir>/.codex/agent-tracer/latest-session.json`.
 * The observer reads this file to determine which rollout to tail when
 * no explicit --session-marker is provided.
 */
export async function writeLatestSessionState(
    input: {
        readonly sessionId: string;
        readonly modelId?: string;
        readonly source?: string;
    },
    projectDir: string = PROJECT_DIR,
): Promise<string> {
    const dir = path.join(projectDir, ".codex", SESSION_STATE_DIR);
    const file = path.join(dir, SESSION_STATE_FILE);

    await mkdir(dir, { recursive: true });
    await writeFile(file, `${JSON.stringify({
        sessionId: input.sessionId,
        ...(input.modelId ? { modelId: input.modelId } : {}),
        ...(input.source ? { source: input.source } : {}),
        updatedAt: new Date().toISOString(),
    }, null, 2)}\n`, "utf8");

    return file;
}

/**
 * Reads the latest-session hint file. Returns null if the file is missing,
 * malformed, or does not contain a valid sessionId.
 */
export async function readLatestSessionState(
    projectDir: string = PROJECT_DIR,
): Promise<CodexLatestSessionState | null> {
    const file = path.join(projectDir, ".codex", SESSION_STATE_DIR, SESSION_STATE_FILE);

    try {
        const raw = await readFile(file, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        if (!isRecord(parsed)) return null;

        const sessionId = toTrimmedString(parsed["sessionId"]);
        if (!sessionId) return null;

        const updatedAt = toTrimmedString(parsed["updatedAt"]) || new Date().toISOString();
        const modelId = toTrimmedString(parsed["modelId"]);
        const source = toTrimmedString(parsed["source"]);

        return {
            sessionId,
            ...(modelId ? { modelId } : {}),
            ...(source ? { source } : {}),
            updatedAt,
        };
    } catch {
        return null;
    }
}

/**
 * Persists observer PID and session info to
 * `<projectDir>/.codex/agent-tracer/observer.json`.
 * Written by the observer on startup so the SessionStart hook can detect
 * whether a compatible observer is already running.
 */
export async function writeObserverState(
    input: CodexObserverState,
    projectDir: string = PROJECT_DIR,
): Promise<string> {
    const dir = path.join(projectDir, ".codex", SESSION_STATE_DIR);
    const file = path.join(dir, OBSERVER_STATE_FILE);

    await mkdir(dir, { recursive: true });
    await writeFile(file, `${JSON.stringify(input, null, 2)}\n`, "utf8");

    return file;
}

/**
 * Reads the observer state file. Returns null if missing, malformed,
 * or if pid is not a positive finite integer.
 */
export async function readObserverState(
    projectDir: string = PROJECT_DIR,
): Promise<CodexObserverState | null> {
    const file = path.join(projectDir, ".codex", SESSION_STATE_DIR, OBSERVER_STATE_FILE);

    try {
        const raw = await readFile(file, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        if (!isRecord(parsed)) return null;

        const pid = typeof parsed["pid"] === "number" ? parsed["pid"] : NaN;
        if (!Number.isFinite(pid) || pid <= 0) return null;

        const sessionId = toTrimmedString(parsed["sessionId"]);
        const startedAt = toTrimmedString(parsed["startedAt"]) || new Date().toISOString();
        return {
            pid,
            ...(sessionId ? { sessionId } : {}),
            startedAt,
        };
    } catch {
        return null;
    }
}

/**
 * Overwrites the observer state file with `{}` to signal that no observer
 * is running. Called in the observer's finally block and on SIGINT/SIGTERM.
 * Errors are swallowed — cleanup is best-effort.
 */
export async function clearObserverState(
    projectDir: string = PROJECT_DIR,
): Promise<void> {
    const file = path.join(projectDir, ".codex", SESSION_STATE_DIR, OBSERVER_STATE_FILE);
    try {
        await writeFile(file, "{}", "utf8");
    } catch {
        // Best effort cleanup only.
    }
}

/**
 * Checks whether a process is alive by sending signal 0 (no-op).
 * Returns false if the process does not exist or permission is denied.
 */
export function isPidRunning(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}
