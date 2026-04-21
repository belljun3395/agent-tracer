/**
 * Codex Rollout File Reader
 *
 * Utilities for discovering and streaming events from Codex rollout JSONL files.
 *
 * Codex writes session data to:
 *   ~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-<timestamp>-<sessionId>.jsonl
 *
 * Each line is a JSON object with a "type" field. Lines consumed here:
 *   session_meta  { type: "session_meta", payload: { id, model, model_provider, cwd } }
 *     First line of the file; contains session-level metadata.
 *   event_msg     { type: "event_msg", payload: { type: "token_count", info, rate_limits } }
 *     Token-usage snapshot; emitted after each model response turn.
 *   turn_context  { type: "turn_context", payload: { turn_id, model } }
 *     Identifies the current turn and the model used for it.
 *
 * Exports:
 *   resolveRolloutPath        — locates the rollout file by session ID, with retry
 *   readRolloutSessionMeta    — reads the session_meta line from the file header
 *   tailRolloutEvents         — async generator that streams events as they are appended
 *   normalizeRolloutTokenCount — normalizes a raw event_msg payload into a RolloutEvent
 *   normalizeRolloutTurnContext — normalizes a raw turn_context payload into a RolloutEvent
 */
import {createReadStream, promises as fs} from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline";
import {StringDecoder} from "node:string_decoder";
import {isRecord, parseJsonLine, toTrimmedString} from "~codex/util/utils.js";
import type {
    CodexAppServerRateLimitSnapshot,
    CodexAppServerRateLimitWindow,
    CodexAppServerThreadTokenUsage,
    CodexAppServerTokenUsageBreakdown,
} from "./protocol.type.js";

export interface RolloutTokenCountPayload {
    readonly kind: "tokenCount";
    readonly tokenUsage: CodexAppServerThreadTokenUsage | undefined;
    readonly rateLimits: CodexAppServerRateLimitSnapshot | undefined;
}

export interface RolloutTurnContextPayload {
    readonly kind: "turnContext";
    readonly turnId: string | undefined;
    readonly modelId: string | undefined;
}

export interface RolloutApplyPatchPayload {
    readonly kind: "applyPatch";
    readonly callId: string | undefined;
    readonly input: string;
    readonly filePaths: readonly string[];
}

export interface RolloutMcpCallPayload {
    readonly kind: "mcpCall";
    readonly callId: string | undefined;
    readonly name: string;
    readonly server: string;
    readonly tool: string;
    readonly arguments: unknown;
}

export interface RolloutWebSearchPayload {
    readonly kind: "webSearch";
    readonly callId: string | undefined;
    readonly status: string | undefined;
    readonly actionType: string | undefined;
    readonly query: string | undefined;
    readonly queries: readonly string[];
    readonly url: string | undefined;
    readonly pattern: string | undefined;
}

export type RolloutEvent =
    | RolloutTokenCountPayload
    | RolloutTurnContextPayload
    | RolloutApplyPatchPayload
    | RolloutMcpCallPayload
    | RolloutWebSearchPayload;

export interface RolloutSessionMeta {
    readonly sessionId: string;
    readonly modelId?: string;
    readonly modelProvider?: string;
    readonly cwd?: string;
}

export interface ResolveRolloutOptions {
    readonly rolloutPath?: string;
    readonly sessionsRoot?: string;
    readonly timeoutMs?: number;
    readonly intervalMs?: number;
    readonly signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_INTERVAL_MS = 250;
const CODEX_BARE_MCP_TOOL_NAMES = new Map<string, { server: string; tool: string }>([
    ["resolve_library_id", { server: "context7", tool: "resolve_library_id" }],
    ["query_docs", { server: "context7", tool: "query_docs" }],
    ["browser_take_screenshot", { server: "playwright", tool: "browser_take_screenshot" }],
    ["browser_snapshot", { server: "playwright", tool: "browser_snapshot" }],
    ["browser_install", { server: "playwright", tool: "browser_install" }],
    ["browser_resize", { server: "playwright", tool: "browser_resize" }],
    ["browser_tabs", { server: "playwright", tool: "browser_tabs" }],
    ["browser_close", { server: "playwright", tool: "browser_close" }],
    ["browser_navigate_back", { server: "playwright", tool: "browser_navigate_back" }],
    ["browser_hover", { server: "playwright", tool: "browser_hover" }],
    ["browser_navigate", { server: "playwright", tool: "browser_navigate" }],
    ["browser_network_requests", { server: "playwright", tool: "browser_network_requests" }],
    ["browser_evaluate", { server: "playwright", tool: "browser_evaluate" }],
    ["browser_click", { server: "playwright", tool: "browser_click" }],
    ["_resolve_review_thread", { server: "github", tool: "_resolve_review_thread" }],
    ["_lock_issue_conversation", { server: "github", tool: "_lock_issue_conversation" }],
    ["_list_pull_request_review_threads", { server: "github", tool: "_list_pull_request_review_threads" }],
    ["_list_installed_accounts", { server: "github", tool: "_list_installed_accounts" }],
    ["_list_installations", { server: "github", tool: "_list_installations" }],
    ["_fetch_pr_comments", { server: "github", tool: "_fetch_pr_comments" }],
    ["_bulk_label_matching_emails", { server: "gmail", tool: "_bulk_label_matching_emails" }],
    ["_batch_read_email_threads", { server: "gmail", tool: "_batch_read_email_threads" }],
    ["_get_metadata", { server: "figma", tool: "_get_metadata" }],
]);

export function defaultSessionsRoot(): string {
    return path.join(os.homedir(), ".codex", "sessions");
}

/**
 * Resolves the rollout JSONL file path for `sessionId`.
 *
 * If `opts.rolloutPath` is provided it is used directly (after confirming the
 * file exists). Otherwise the sessions tree at `~/.codex/sessions` is searched
 * for a file matching `rollout-*-<sessionId>.jsonl`, scanning year/month/day
 * directories in reverse-chronological order.
 *
 * Retries every `intervalMs` (default 250ms) up to `timeoutMs` (default 30 s)
 * to handle the case where Codex creates the file after the observer starts.
 * Throws if the file is not found within the timeout or if `signal` is aborted.
 */
export async function resolveRolloutPath(
    sessionId: string,
    opts: ResolveRolloutOptions = {},
): Promise<string> {
    const trimmed = toTrimmedString(sessionId);
    if (!trimmed) {
        throw new Error("resolveRolloutPath requires a non-empty sessionId");
    }

    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
        if (opts.rolloutPath) {
            if (await pathExists(opts.rolloutPath)) return opts.rolloutPath;
        } else {
            const root = opts.sessionsRoot ?? defaultSessionsRoot();
            const found = await findRolloutBySessionId(root, trimmed);
            if (found) return found;
        }

        if (opts.signal?.aborted) throw new Error("resolveRolloutPath aborted");
        if (Date.now() + intervalMs > deadline) break;
        await delay(intervalMs, opts.signal);
    }
    throw new Error(`Codex rollout file not found for session ${trimmed} within ${timeoutMs}ms`);
}

/**
 * Reads the first `session_meta` line from the rollout file.
 * Returns null if no matching line is found (e.g. file is still being written).
 * Only reads forward through the file — stops at the first session_meta record.
 */
export async function readRolloutSessionMeta(filePath: string): Promise<RolloutSessionMeta | null> {
    const stream = createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream });
    try {
        for await (const line of rl) {
            const parsed = parseJsonLine(line);
            if (!parsed) continue;
            if (parsed["type"] !== "session_meta") continue;
            const payload = isRecord(parsed["payload"]) ? parsed["payload"] : {};
            const id = toTrimmedString(payload["id"]);
            if (!id) return null;
            const modelId = toTrimmedString(payload["model"]);
            const modelProvider = toTrimmedString(payload["model_provider"]);
            const cwd = toTrimmedString(payload["cwd"]);
            return {
                sessionId: id,
                ...(modelId ? { modelId } : {}),
                ...(modelProvider ? { modelProvider } : {}),
                ...(cwd ? { cwd } : {}),
            };
        }
        return null;
    } finally {
        rl.close();
        stream.destroy();
    }
}

export function normalizeRolloutTokenCount(
    raw: unknown,
): RolloutTokenCountPayload | null {
    const payload = isRecord(raw) ? raw : null;
    if (!payload) return null;
    if (payload["type"] !== "token_count") return null;

    const info = isRecord(payload["info"]) ? payload["info"] : null;
    const tokenUsage = info ? buildTokenUsage(info) : undefined;
    const rateLimits = asRateLimitSnapshot(payload["rate_limits"]);

    if (!tokenUsage && !rateLimits) return null;
    return { kind: "tokenCount", tokenUsage, rateLimits: rateLimits ?? undefined };
}

export function normalizeRolloutTurnContext(
    raw: unknown,
): RolloutTurnContextPayload | null {
    const payload = isRecord(raw) ? raw : null;
    if (!payload) return null;
    const turnId = toTrimmedString(payload["turn_id"]);
    const modelId = toTrimmedString(payload["model"]);
    if (!turnId && !modelId) return null;
    return {
        kind: "turnContext",
        turnId: turnId || undefined,
        modelId: modelId || undefined,
    };
}

export function normalizeRolloutResponseItem(raw: unknown): RolloutEvent | null {
    const payload = isRecord(raw) ? raw : null;
    if (!payload) return null;

    if (payload["type"] === "custom_tool_call") {
        return normalizeCustomToolCall(payload);
    }
    if (payload["type"] === "function_call") {
        return normalizeFunctionCall(payload);
    }
    if (payload["type"] === "web_search_call") {
        return normalizeWebSearchCall(payload);
    }
    return null;
}

/**
 * Async generator that tails `filePath` and yields typed RolloutEvents as new
 * lines are appended. Reads in 64 KB chunks, reassembles lines across chunks,
 * and polls every 250ms when no new data is available.
 *
 * Terminates when `signal` is aborted. The file handle is always closed in the
 * finally block, even if the generator is abandoned mid-iteration.
 *
 * Lines that do not map to a known event type are silently skipped.
 */
export async function* tailRolloutEvents(
    filePath: string,
    signal?: AbortSignal,
): AsyncGenerator<RolloutEvent> {
    const handle = await fs.open(filePath, "r");
    const decoder = new StringDecoder("utf8");
    const abortSignal = signal ?? new AbortController().signal;
    let position = 0;
    let buffer = "";
    const chunkSize = 64 * 1024;
    const pollIntervalMs = 250;

    try {
        while (!abortSignal.aborted) {
            const chunk = Buffer.alloc(chunkSize);
            const { bytesRead } = await handle.read(chunk, 0, chunkSize, position);

            if (bytesRead > 0) {
                position += bytesRead;
                buffer += decoder.write(chunk.subarray(0, bytesRead));

                let newlineIndex = buffer.indexOf("\n");
                while (newlineIndex !== -1) {
                    const line = buffer.slice(0, newlineIndex);
                    buffer = buffer.slice(newlineIndex + 1);
                    const event = extractRolloutEvent(line);
                    if (event) yield event;
                    newlineIndex = buffer.indexOf("\n");
                }
                continue;
            }

            await delay(pollIntervalMs, abortSignal);
        }
    } finally {
        buffer += decoder.end();
        await handle.close().catch(() => undefined);
    }
}

function extractRolloutEvent(line: string): RolloutEvent | null {
    const parsed = parseJsonLine(line);
    if (!parsed) return null;
    const type = parsed["type"];
    if (type === "event_msg") {
        return normalizeRolloutTokenCount(parsed["payload"]);
    }
    if (type === "turn_context") {
        return normalizeRolloutTurnContext(parsed["payload"]);
    }
    if (type === "response_item") {
        return normalizeRolloutResponseItem(parsed["payload"]);
    }
    return null;
}

function normalizeCustomToolCall(payload: Record<string, unknown>): RolloutApplyPatchPayload | null {
    const name = toTrimmedString(payload["name"]);
    if (name !== "apply_patch") return null;
    const input = toTrimmedString(payload["input"]);
    if (!input) return null;
    const callId = toTrimmedString(payload["call_id"]);
    return {
        kind: "applyPatch",
        callId: callId || undefined,
        input,
        filePaths: extractPatchFilePaths(input),
    };
}

function normalizeFunctionCall(payload: Record<string, unknown>): RolloutMcpCallPayload | null {
    const name = toTrimmedString(payload["name"]);
    const parsedName = parseMcpToolName(name);
    if (!parsedName) return null;
    const callId = toTrimmedString(payload["call_id"]);
    return {
        kind: "mcpCall",
        callId: callId || undefined,
        name: parsedName.sourceName,
        server: parsedName.server,
        tool: parsedName.tool,
        arguments: parseJsonValue(payload["arguments"]),
    };
}

function normalizeWebSearchCall(payload: Record<string, unknown>): RolloutWebSearchPayload | null {
    const action = isRecord(payload["action"]) ? payload["action"] : {};
    const callId = toTrimmedString(payload["call_id"]);
    const status = toTrimmedString(payload["status"]);
    const actionType = toTrimmedString(action["type"]);
    const query = toTrimmedString(action["query"]);
    const url = toTrimmedString(action["url"]);
    const pattern = toTrimmedString(action["pattern"]);
    const queries = Array.isArray(action["queries"])
        ? action["queries"].map((value) => toTrimmedString(value)).filter(Boolean)
        : [];

    if (!actionType && !query && !url && !pattern && queries.length === 0) return null;
    return {
        kind: "webSearch",
        callId: callId || undefined,
        status: status || undefined,
        actionType: actionType || undefined,
        query: query || undefined,
        queries,
        url: url || undefined,
        pattern: pattern || undefined,
    };
}

function parseMcpToolName(name: string): { server: string; tool: string; sourceName: string } | null {
    if (name.startsWith("mcp__")) {
        const parts = name.split("__");
        const server = parts[1]?.trim();
        const tool = parts.slice(2).join("__").trim();
        if (!server || !tool) return null;
        return { server, tool, sourceName: name };
    }

    const bareTool = CODEX_BARE_MCP_TOOL_NAMES.get(name);
    if (!bareTool) return null;
    return {
        ...bareTool,
        sourceName: `mcp__${bareTool.server}__${bareTool.tool}`,
    };
}

function parseJsonValue(value: unknown): unknown {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value) as unknown;
    } catch {
        return value;
    }
}

function extractPatchFilePaths(input: string): readonly string[] {
    const seen = new Set<string>();
    const filePaths: string[] = [];
    for (const line of input.split(/\r?\n/)) {
        const match = /^\*\*\* (?:Add File|Update File|Delete File|Move to):\s+(.+?)\s*$/.exec(line);
        const filePath = match?.[1]?.trim();
        if (!filePath || seen.has(filePath)) continue;
        seen.add(filePath);
        filePaths.push(filePath);
    }
    return filePaths;
}

function buildTokenUsage(info: Record<string, unknown>): CodexAppServerThreadTokenUsage | undefined {
    const total = asBreakdown(info["total_token_usage"]);
    const last = asBreakdown(info["last_token_usage"]);
    if (!total || !last) return undefined;
    const window = asNumber(info["model_context_window"]);
    return {
        total,
        last,
        modelContextWindow: window,
    };
}

function asBreakdown(value: unknown): CodexAppServerTokenUsageBreakdown | null {
    const record = isRecord(value) ? value : null;
    if (!record) return null;
    const totalTokens = asNumber(record["total_tokens"]);
    const inputTokens = asNumber(record["input_tokens"]);
    const cachedInputTokens = asNumber(record["cached_input_tokens"]);
    const outputTokens = asNumber(record["output_tokens"]);
    const reasoningOutputTokens = asNumber(record["reasoning_output_tokens"]);
    if (
        totalTokens == null
        || inputTokens == null
        || cachedInputTokens == null
        || outputTokens == null
        || reasoningOutputTokens == null
    ) return null;
    return {
        totalTokens,
        inputTokens,
        cachedInputTokens,
        outputTokens,
        reasoningOutputTokens,
    };
}

function asRateLimitSnapshot(value: unknown): CodexAppServerRateLimitSnapshot | null {
    const record = isRecord(value) ? value : null;
    if (!record) return null;
    return {
        limitId: asNullableString(record["limit_id"]),
        limitName: asNullableString(record["limit_name"]),
        primary: asRateLimitWindow(record["primary"]),
        secondary: asRateLimitWindow(record["secondary"]),
    };
}

function asRateLimitWindow(value: unknown): CodexAppServerRateLimitWindow | null {
    const record = isRecord(value) ? value : null;
    if (!record) return null;
    const usedPercent = asNumber(record["used_percent"]);
    if (usedPercent == null) return null;
    return {
        usedPercent,
        windowDurationMins: asNumber(record["window_minutes"]),
        resetsAt: asNumber(record["resets_at"]),
    };
}

function asNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

async function pathExists(p: string): Promise<boolean> {
    try {
        const stat = await fs.stat(p);
        return stat.isFile();
    } catch {
        return false;
    }
}

async function findRolloutBySessionId(
    sessionsRoot: string,
    sessionId: string,
): Promise<string | null> {
    const suffix = `-${sessionId}.jsonl`;
    const years = await safeReaddir(sessionsRoot);
    years.sort().reverse();
    for (const year of years) {
        const yearDir = path.join(sessionsRoot, year);
        const months = await safeReaddir(yearDir);
        months.sort().reverse();
        for (const month of months) {
            const monthDir = path.join(yearDir, month);
            const days = await safeReaddir(monthDir);
            days.sort().reverse();
            for (const day of days) {
                const dayDir = path.join(monthDir, day);
                const files = await safeReaddir(dayDir);
                for (const file of files) {
                    if (file.endsWith(suffix) && file.startsWith("rollout-")) {
                        return path.join(dayDir, file);
                    }
                }
            }
        }
    }
    return null;
}

async function safeReaddir(dir: string): Promise<string[]> {
    try {
        return await fs.readdir(dir);
    } catch {
        return [];
    }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new Error("aborted"));
            return;
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        const onAbort = (): void => {
            clearTimeout(timer);
            reject(new Error("aborted"));
        };
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}

// Exported for test coverage of the tail helper.
export const __test__ = { extractRolloutEvent, findRolloutBySessionId, delay };
