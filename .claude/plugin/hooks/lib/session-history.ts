/**
 * Session History Management
 *
 * Persists session metadata to a local history file for resume support.
 * Each session record includes resumeId, taskId, cwd, and lifecycle timestamps.
 *
 * File: ~/.claude/.session-history.json
 * Structure: { sessions: SessionRecord[] }
 */

import * as fs from "node:fs";
import * as path from "node:path";

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

function readSessionHistory(): SessionHistory {
    try {
        const content = fs.readFileSync(SESSION_HISTORY_FILE, "utf-8");
        const parsed = JSON.parse(content) as unknown;
        if (
            typeof parsed === "object" &&
            parsed !== null &&
            "sessions" in parsed &&
            Array.isArray((parsed as Record<string, unknown>).sessions)
        ) {
            return parsed as SessionHistory;
        }
    } catch {
        // File doesn't exist or is invalid; return empty structure
    }
    return { sessions: [] };
}

function writeSessionHistory(history: SessionHistory): void {
    try {
        fs.mkdirSync(SESSION_HISTORY_DIR, { recursive: true });
        fs.writeFileSync(SESSION_HISTORY_FILE, JSON.stringify(history, null, 2));
    } catch {
        // Silently fail if unable to write
    }
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

