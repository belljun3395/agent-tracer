import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { JsonObject } from "./common.js";
import {
    PROJECT_DIR,
    buildSemanticMetadata,
    createMessageId,
    ellipsize,
    hookLog,
    inferExploreSemantic,
    inferFileToolSemantic,
    isRecord,
    postJson,
    relativeProjectPath,
    toTrimmedString
} from "./common.js";
import {
    consumePendingUserPrompt,
    isTurnAlreadyProcessed,
    markTurnProcessed,
    readHookState,
    writeHookState
} from "./hook_state.js";

interface RuntimeIds {
    readonly taskId: string;
    readonly sessionId: string;
}

export async function backfillTurnEventsFromTranscript(payload: JsonObject, ids: RuntimeIds): Promise<void> {
    const runtimeSessionId = toTrimmedString(payload.session_id);
    if (!runtimeSessionId) {
        hookLog("stop", "transcript backfill skipped — missing session id");
        return;
    }

    const transcriptPath = resolveTranscriptPath(payload, runtimeSessionId);
    if (!transcriptPath) {
        hookLog("stop", "transcript backfill skipped — transcript path unavailable", { runtimeSessionId });
        return;
    }

    const rows = readTranscriptRows(transcriptPath);
    if (rows.length === 0) {
        hookLog("stop", "transcript backfill skipped — transcript has no rows", { transcriptPath });
        return;
    }

    const turnId = resolveTurnId(payload, rows);
    if (!turnId) {
        hookLog("stop", "transcript backfill skipped — turn id unavailable", { transcriptPath, runtimeSessionId });
        return;
    }

    const state = readHookState();
    if (isTurnAlreadyProcessed(state, runtimeSessionId, turnId)) {
        hookLog("stop", "transcript backfill skipped — turn already processed", { runtimeSessionId, turnId });
        return;
    }

    const turnRows = extractRowsForTurn(rows, turnId);
    if (turnRows.length === 0) {
        hookLog("stop", "transcript backfill skipped — turn rows not found", { turnId });
        return;
    }

    const { count: userCount, nextState: stateAfterUsers } = await postUserMessageEvents(turnRows, ids, state, runtimeSessionId);
    const webCount = await postWebSearchEvents(turnRows, ids);
    const patchCount = await postApplyPatchEvents(turnRows, ids);

    const nextState = markTurnProcessed(stateAfterUsers, runtimeSessionId, turnId);
    writeHookState(nextState);

    hookLog("stop", "transcript backfill posted", { transcriptPath, turnId, userCount, webCount, patchCount });
}

function readTranscriptRows(transcriptPath: string): JsonObject[] {
    try {
        const raw = fs.readFileSync(transcriptPath, "utf8");
        if (!raw.trim()) return [];

        return raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                try {
                    const parsed = JSON.parse(line) as unknown;
                    return isRecord(parsed) ? parsed : {};
                } catch {
                    return {};
                }
            });
    } catch (error) {
        hookLog("stop", "failed to read transcript", { transcriptPath, error: String(error) });
        return [];
    }
}

function resolveTranscriptPath(payload: JsonObject, runtimeSessionId: string): string {
    const explicitPath = toTrimmedString(payload.transcript_path);
    if (explicitPath) return explicitPath;

    const inferredPath = findTranscriptPathBySessionId(runtimeSessionId);
    if (inferredPath) {
        hookLog("stop", "resolved transcript path from session", { runtimeSessionId, transcriptPath: inferredPath });
    }
    return inferredPath;
}

function resolveTurnId(payload: JsonObject, rows: JsonObject[]): string {
    const explicitTurnId = toTrimmedString(payload.turn_id);
    if (explicitTurnId) return explicitTurnId;

    const responseText = toTrimmedString(payload.last_assistant_message, 100_000);
    if (responseText) {
        for (let index = rows.length - 1; index >= 0; index -= 1) {
            const row = rows[index];
            if (!row) continue;
            if (toTrimmedString(row.type) !== "event_msg") continue;
            const rowPayload = getPayload(row);
            if (toTrimmedString(rowPayload.type) !== "task_complete") continue;
            if (toTrimmedString(rowPayload.last_agent_message, 100_000) !== responseText) continue;
            const matchedTurnId = toTrimmedString(rowPayload.turn_id);
            if (matchedTurnId) return matchedTurnId;
        }
    }

    for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];
        if (!row) continue;
        if (toTrimmedString(row.type) !== "event_msg") continue;
        const rowPayload = getPayload(row);
        if (toTrimmedString(rowPayload.type) !== "task_complete") continue;
        const matchedTurnId = toTrimmedString(rowPayload.turn_id);
        if (matchedTurnId) return matchedTurnId;
    }

    for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];
        if (!row) continue;
        if (toTrimmedString(row.type) !== "event_msg") continue;
        const rowPayload = getPayload(row);
        if (toTrimmedString(rowPayload.type) !== "task_started") continue;
        const matchedTurnId = toTrimmedString(rowPayload.turn_id);
        if (matchedTurnId) return matchedTurnId;
    }

    return "";
}

function extractRowsForTurn(rows: JsonObject[], turnId: string): JsonObject[] {
    const startIndex = rows.findIndex((row) => {
        if (toTrimmedString(row.type) !== "event_msg") return false;
        const payload = getPayload(row);
        return toTrimmedString(payload.type) === "task_started"
            && toTrimmedString(payload.turn_id) === turnId;
    });

    if (startIndex < 0) return [];

    const endIndex = rows.findIndex((row, index) => {
        if (index < startIndex) return false;
        if (toTrimmedString(row.type) !== "event_msg") return false;
        const payload = getPayload(row);
        return toTrimmedString(payload.type) === "task_complete"
            && toTrimmedString(payload.turn_id) === turnId;
    });

    return rows.slice(startIndex, endIndex >= startIndex ? endIndex + 1 : rows.length);
}

async function postUserMessageEvents(
    rows: JsonObject[],
    ids: RuntimeIds,
    initialState: ReturnType<typeof readHookState>,
    runtimeSessionId: string
): Promise<{ readonly count: number; readonly nextState: ReturnType<typeof readHookState> }> {
    let state = initialState;
    let count = 0;

    for (const row of rows) {
        if (toTrimmedString(row.type) !== "event_msg") continue;
        const payload = getPayload(row);
        if (toTrimmedString(payload.type) !== "user_message") continue;

        const message = toTrimmedString(payload.message, 100_000);
        if (!message) continue;

        const consumed = consumePendingUserPrompt(state, runtimeSessionId, message);
        state = consumed.state;
        if (consumed.matched) continue;

        await postJson("/api/user-message", {
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            messageId: createMessageId(),
            captureMode: "raw",
            source: "codex-hook",
            title: ellipsize(message, 120),
            body: message
        });
        count += 1;
    }

    return { count, nextState: state };
}

async function postWebSearchEvents(rows: JsonObject[], ids: RuntimeIds): Promise<number> {
    const seenCallIds = new Set<string>();
    let count = 0;

    for (const row of rows) {
        if (toTrimmedString(row.type) !== "event_msg") continue;
        const payload = getPayload(row);
        if (toTrimmedString(payload.type) !== "web_search_end") continue;

        const callId = toTrimmedString(payload.call_id);
        if (callId && seenCallIds.has(callId)) continue;
        if (callId) seenCallIds.add(callId);

        const query = toTrimmedString(payload.query, 4000);
        const action = isRecord(payload.action) ? payload.action : {};
        const actionType = toTrimmedString(action.type);
        const actionUrl = toTrimmedString(action.url, 4000);
        const actionPattern = toTrimmedString(action.pattern, 4000);

        const toolInput: JsonObject = {
            ...(query ? { query } : {}),
            ...(actionUrl ? { url: actionUrl } : {}),
            ...(actionPattern ? { pattern: actionPattern } : {})
        };
        const semanticToolName = actionType === "open_page" ? "webfetch" : "websearch";
        const semantic = inferExploreSemantic(semanticToolName, toolInput);

        await postJson("/api/explore", {
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            toolName: "web_search",
            title: buildWebSearchTitle(actionType, query, actionUrl, actionPattern),
            body: buildWebSearchBody(query, actionType, actionUrl, actionPattern),
            lane: "exploration",
            metadata: {
                ...(callId ? { callId } : {}),
                query,
                actionType,
                ...(actionUrl ? { url: actionUrl } : {}),
                ...(actionPattern ? { pattern: actionPattern } : {}),
                ...buildSemanticMetadata(semantic)
            }
        });
        count += 1;
    }

    return count;
}

function findTranscriptPathBySessionId(runtimeSessionId: string): string {
    const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
    const candidates: string[] = [];

    for (const rootDir of [path.join(codexHome, "sessions"), path.join(codexHome, "archived_sessions")]) {
        collectTranscriptCandidates(rootDir, runtimeSessionId, candidates);
    }

    return candidates.sort().at(-1) ?? "";
}

function collectTranscriptCandidates(rootDir: string, runtimeSessionId: string, candidates: string[]): void {
    try {
        const entries = fs.readdirSync(rootDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(rootDir, entry.name);
            if (entry.isDirectory()) {
                collectTranscriptCandidates(fullPath, runtimeSessionId, candidates);
                continue;
            }
            if (entry.isFile() && isTranscriptCandidate(entry.name, runtimeSessionId)) {
                candidates.push(fullPath);
            }
        }
    } catch {
        // Ignore missing/unreadable roots and keep searching other locations.
    }
}

function isTranscriptCandidate(filename: string, runtimeSessionId: string): boolean {
    return filename.endsWith(".jsonl")
        && filename.includes(runtimeSessionId)
        && filename.startsWith("rollout-");
}

async function postApplyPatchEvents(rows: JsonObject[], ids: RuntimeIds): Promise<number> {
    const seenCallIds = new Set<string>();
    let count = 0;

    for (const row of rows) {
        if (toTrimmedString(row.type) !== "response_item") continue;
        const payload = getPayload(row);
        if (toTrimmedString(payload.type) !== "custom_tool_call") continue;
        if (toTrimmedString(payload.name) !== "apply_patch") continue;
        const status = toTrimmedString(payload.status).toLowerCase();
        if (status && status !== "completed") continue;

        const callId = toTrimmedString(payload.call_id);
        if (callId && seenCallIds.has(callId)) continue;
        if (callId) seenCallIds.add(callId);

        const patchInput = toTrimmedString(payload.input, 100_000);
        const absoluteFilePaths = parsePatchedFilePaths(patchInput);
        const filePaths = absoluteFilePaths.map((candidate) => relativeProjectPath(candidate));
        const primaryPath = absoluteFilePaths[0] ?? "";
        const semantic = inferFileToolSemantic("apply_patch", { path: primaryPath });

        await postJson("/api/tool-used", {
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            toolName: "apply_patch",
            title: absoluteFilePaths.length > 0
                ? `Apply patch (${absoluteFilePaths.length} file${absoluteFilePaths.length === 1 ? "" : "s"})`
                : "Apply patch",
            body: absoluteFilePaths.length > 0
                ? filePaths.join("\n")
                : undefined,
            lane: "implementation",
            ...(absoluteFilePaths.length > 0 ? { filePaths } : {}),
            metadata: {
                ...(callId ? { callId } : {}),
                fileCount: absoluteFilePaths.length,
                ...(filePaths.length > 0 ? { patchedFiles: filePaths } : {}),
                ...buildSemanticMetadata(semantic)
            }
        });
        count += 1;
    }

    return count;
}

function buildWebSearchTitle(actionType: string, query: string, url: string, pattern: string): string {
    if (actionType === "open_page") {
        return `Open page: ${ellipsize(url || query || "web page", 120)}`;
    }
    if (actionType === "find_in_page") {
        return `Find in page: ${ellipsize(pattern || query || "pattern", 120)}`;
    }
    if (actionType === "search") {
        return `Web search: ${ellipsize(query || "query", 120)}`;
    }
    const detail = ellipsize(query || url || pattern || "web activity", 120);
    return `Web activity: ${detail}`;
}

function buildWebSearchBody(query: string, actionType: string, url: string, pattern: string): string | undefined {
    const lines = [
        query ? `query: ${query}` : "",
        actionType ? `action: ${actionType}` : "",
        url ? `url: ${url}` : "",
        pattern ? `pattern: ${pattern}` : ""
    ].filter(Boolean);
    return lines.length > 0 ? lines.join("\n") : undefined;
}

function parsePatchedFilePaths(patchInput: string): string[] {
    if (!patchInput) return [];

    const absolutePaths = new Set<string>();
    const fileRegex = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm;
    for (const match of patchInput.matchAll(fileRegex)) {
        const rawPath = toTrimmedString(match[1]);
        if (!rawPath) continue;
        absolutePaths.add(toAbsoluteProjectPath(rawPath));
    }

    const moveRegex = /^\*\*\* Move to: (.+)$/gm;
    for (const match of patchInput.matchAll(moveRegex)) {
        const rawPath = toTrimmedString(match[1]);
        if (!rawPath) continue;
        absolutePaths.add(toAbsoluteProjectPath(rawPath));
    }

    return Array.from(absolutePaths.values());
}

function toAbsoluteProjectPath(candidate: string): string {
    if (path.isAbsolute(candidate)) return candidate;
    return path.join(PROJECT_DIR, candidate);
}

function getPayload(row: JsonObject): JsonObject {
    return isRecord(row.payload) ? row.payload : {};
}
