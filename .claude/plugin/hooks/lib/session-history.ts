/**
 * Session History Management
 *
 * Persists session metadata to a local history file for resume support.
 * Each session record includes resumeId, taskId, cwd, and lifecycle timestamps.
 *
 * File: ~/.claude/.session-history.json
 * Structure: { sessions: SessionRecord[] }
 */
import * as path from "node:path";
import { readJsonFile, writeJsonFile } from "./json-file-store.js";

const SESSION_HISTORY_DIR = path.join(
    process.env.HOME || process.env.USERPROFILE || "/tmp",
    ".claude"
);
const SESSION_HISTORY_FILE = path.join(SESSION_HISTORY_DIR, ".session-history.json");

export interface SessionRecord {
    /** Resume ID with runtime prefix (e.g., "claude-code::uuid") */
    resumeId: string;
    /** Claude Code session ID */
    sessionId: string;
    /** Runtime source that created this session */
    runtimeSource: string;
    /** Task ID in Agent Tracer monitor */
    taskId: string;
    /** Working directory when session started */
    projectDir: string;
    /** Session start timestamp (ms) */
    startedAt: number;
    /** Session end timestamp (ms) */
    endedAt: number;
    /** Why the session ended */
    reason?: string;
}

interface SessionHistory {
    sessions: SessionRecord[];
}

function isSessionRecord(value: unknown): value is SessionRecord {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const candidate = value as Partial<SessionRecord>;
    return (
        typeof candidate.resumeId === "string" &&
        typeof candidate.sessionId === "string" &&
        typeof candidate.runtimeSource === "string" &&
        typeof candidate.taskId === "string" &&
        typeof candidate.projectDir === "string" &&
        typeof candidate.startedAt === "number" &&
        typeof candidate.endedAt === "number"
    );
}

function isSessionHistory(value: unknown): value is SessionHistory {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const candidate = value as { sessions?: unknown };
    return Array.isArray(candidate.sessions) && candidate.sessions.every(isSessionRecord);
}

function readSessionHistory(): SessionHistory {
    return readJsonFile(SESSION_HISTORY_FILE, isSessionHistory) ?? { sessions: [] };
}

function writeSessionHistory(history: SessionHistory): void {
    writeJsonFile(SESSION_HISTORY_FILE, history, 2);
}

/**
 * Appends a new session record to the history.
 * @param record - SessionRecord to append
 */
export function appendSessionRecord(record: SessionRecord): void {
    const history = readSessionHistory();
    history.sessions.push(record);
    writeSessionHistory(history);
}
