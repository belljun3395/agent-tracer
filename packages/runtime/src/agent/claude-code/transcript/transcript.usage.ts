import {isRecord} from "~runtime/support/json.js";

/** message.usage에서 뽑은, 값이 유한한 토큰 수만 남긴 요약이다. */
export interface UsageTokens {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheCreateTokens: number;
}

/** input/output 토큰 수가 숫자이고 유한하지 않으면 usage를 통째로 버린다. */
export function extractUsageTokens(usage: unknown): UsageTokens | null {
    if (!isRecord(usage)) return null;
    const inputTokens = usage["input_tokens"];
    const outputTokens = usage["output_tokens"];
    if (!isFiniteNumber(inputTokens) || !isFiniteNumber(outputTokens)) return null;

    const cacheRead = usage["cache_read_input_tokens"];
    const cacheCreate = usage["cache_creation_input_tokens"];
    return {
        inputTokens,
        outputTokens,
        cacheReadTokens: isFiniteNumber(cacheRead) ? cacheRead : 0,
        cacheCreateTokens: isFiniteNumber(cacheCreate) ? cacheCreate : 0,
    };
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}
