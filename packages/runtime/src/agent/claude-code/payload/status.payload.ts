import {
    readNumber,
    readOptionalString,
    readRecord,
    readString,
    type ReaderResult,
} from "~runtime/agent/claude-code/payload/field.payload.js";
import type {ContextSnapshotInput} from "~runtime/domain/ingest/model/lifecycle.event.model.js";
import type {JsonObject} from "~runtime/support/json.js";

/** 상태 표시줄 스크립트가 API 요청마다 stdin으로 받는 사용량 페이로드다. */
export interface StatusLinePayload {
    readonly sessionId: string;
    readonly snapshot: ContextSnapshotInput;
    /** 컨텍스트나 사용 한도 수치가 하나라도 왔는지다. */
    readonly hasTelemetry: boolean;
    readonly usedPct: number | undefined;
    readonly fiveHourPct: number | undefined;
    readonly costUsd: number | undefined;
}

export function readStatusLine(raw: JsonObject): ReaderResult<StatusLinePayload> {
    const sessionId = readString(raw, "session_id");
    if (!sessionId) return {ok: false, reason: "missing session_id"};

    const context = readRecord(raw, "context_window");
    const usage = readRecord(context, "current_usage");
    const rateLimits = readRecord(raw, "rate_limits");
    const fiveHour = readRecord(rateLimits, "five_hour");
    const sevenDay = readRecord(rateLimits, "seven_day");
    const model = readRecord(raw, "model");
    const cost = readNumber(readRecord(raw, "cost"), "total_cost_usd");

    const usedPct = readNumber(context, "used_percentage");
    const inputTokens = readNumber(context, "total_input_tokens");
    const outputTokens = readNumber(context, "total_output_tokens");
    const fiveHourPct = readNumber(fiveHour, "used_percentage");
    const version = readOptionalString(raw, "version");
    const modelId = readOptionalString(model, "id");

    const snapshot: ContextSnapshotInput = {
        ...optional("contextWindowUsedPct", usedPct),
        ...optional("contextWindowRemainingPct", readNumber(context, "remaining_percentage")),
        ...(inputTokens !== undefined
            ? {contextWindowTotalTokens: inputTokens + (outputTokens ?? 0)}
            : {}),
        ...optional("contextWindowSize", readNumber(context, "context_window_size")),
        ...optional("contextWindowInputTokens", readNumber(usage, "input_tokens")),
        ...optional("contextWindowOutputTokens", readNumber(usage, "output_tokens")),
        ...optional("contextWindowCacheCreationTokens", readNumber(usage, "cache_creation_input_tokens")),
        ...optional("contextWindowCacheReadTokens", readNumber(usage, "cache_read_input_tokens")),
        ...optional("rateLimitFiveHourUsedPct", fiveHourPct),
        ...optional("rateLimitFiveHourResetsAt", readNumber(fiveHour, "resets_at")),
        ...optional("rateLimitSevenDayUsedPct", readNumber(sevenDay, "used_percentage")),
        ...optional("rateLimitSevenDayResetsAt", readNumber(sevenDay, "resets_at")),
        ...optional("costTotalUsd", cost),
        ...(modelId !== undefined ? {modelId} : {}),
        ...(version !== undefined ? {sessionVersion: version} : {}),
    };

    return {
        ok: true,
        value: {
            sessionId,
            snapshot,
            hasTelemetry: usedPct !== undefined || Object.keys(rateLimits).length > 0,
            usedPct,
            fiveHourPct,
            costUsd: cost,
        },
    };
}

function optional(key: string, value: number | undefined): Record<string, number> {
    return value !== undefined ? {[key]: value} : {};
}
