import * as fs from "node:fs";
import * as path from "node:path";

import {
    JsonObject,
    PROJECT_DIR,
    buildSemanticMetadata,
    ellipsize,
    hookLog,
    inferExploreSemantic,
    inferFileToolSemantic,
    isRecord,
    postJson,
    relativeProjectPath,
    toTrimmedString
} from "./common.js";

interface RuntimeIds {
    readonly taskId: string;
    readonly sessionId: string;
}

interface HookState {
    readonly processedTurnsBySession: Record<string, string[]>;
}

const STATE_FILE_NAME = ".hook-state.json";
const MAX_TURN_HISTORY = 200;

export async function backfillTurnEventsFromTranscript(payload: JsonObject, ids: RuntimeIds): Promise<void> {
    const runtimeSessionId = toTrimmedString(payload.session_id);
    const turnId = toTrimmedString(payload.turn_id);
    const transcriptPath = toTrimmedString(payload.transcript_path);

    if (!runtimeSessionId || !turnId || !transcriptPath) {
        hookLog("stop", "transcript backfill skipped — missing session/turn/transcript path");
        return;
    }

    const state = readHookState();
    if (isTurnAlreadyProcessed(state, runtimeSessionId, turnId)) {
        hookLog("stop", "transcript backfill skipped — turn already processed", { runtimeSessionId, turnId });
        return;
    }

    const rows = readTranscriptRows(transcriptPath);
    if (rows.length === 0) {
        hookLog("stop", "transcript backfill skipped — transcript has no rows", { transcriptPath });
        return;
    }

    const turnRows = extractRowsForTurn(rows, turnId);
    if (turnRows.length === 0) {
        hookLog("stop", "transcript backfill skipped — turn rows not found", { turnId });
        return;
    }

    const webCount = await postWebSearchEvents(turnRows, ids);
    const patchCount = await postApplyPatchEvents(turnRows, ids);

    const nextState = markTurnProcessed(state, runtimeSessionId, turnId);
    writeHookState(nextState);

    hookLog("stop", "transcript backfill posted", { turnId, webCount, patchCount });
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

function stateFilePath(): string {
    return path.join(PROJECT_DIR, ".codex", STATE_FILE_NAME);
}

function readHookState(): HookState {
    const filename = stateFilePath();
    try {
        const raw = fs.readFileSync(filename, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        if (!isRecord(parsed)) return { processedTurnsBySession: {} };

        const mapped = isRecord(parsed.processedTurnsBySession)
            ? Object.fromEntries(
                Object.entries(parsed.processedTurnsBySession).map(([key, value]) => [
                    key,
                    Array.isArray(value) ? value.map((item) => toTrimmedString(item)).filter(Boolean) : []
                ])
            )
            : {};

        return { processedTurnsBySession: mapped };
    } catch {
        return { processedTurnsBySession: {} };
    }
}

function writeHookState(state: HookState): void {
    const filename = stateFilePath();
    try {
        fs.mkdirSync(path.dirname(filename), { recursive: true });
        fs.writeFileSync(filename, JSON.stringify(state, null, 2));
    } catch (error) {
        hookLog("stop", "failed to write hook state", { error: String(error) });
    }
}

function isTurnAlreadyProcessed(state: HookState, runtimeSessionId: string, turnId: string): boolean {
    const turns = state.processedTurnsBySession[runtimeSessionId] ?? [];
    return turns.includes(turnId);
}

function markTurnProcessed(state: HookState, runtimeSessionId: string, turnId: string): HookState {
    const turns = state.processedTurnsBySession[runtimeSessionId] ?? [];
    const merged = turns.includes(turnId)
        ? turns
        : [...turns, turnId];
    const trimmed = merged.slice(Math.max(0, merged.length - MAX_TURN_HISTORY));

    return {
        processedTurnsBySession: {
            ...state.processedTurnsBySession,
            [runtimeSessionId]: trimmed
        }
    };
}
