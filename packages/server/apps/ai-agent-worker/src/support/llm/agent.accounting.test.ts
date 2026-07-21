import { describe, expect, it } from "vitest";
import { mergeAgentCallAccounting } from "./agent.accounting.js";

describe("mergeAgentCallAccounting", () => {
    it("여러 호출의 비용과 턴과 사용량을 더한다", () => {
        const merged = mergeAgentCallAccounting([
            {
                durationMs: 100,
                costUsd: 0.3,
                numTurns: 4,
                usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 1, cacheCreationTokens: 2 },
            },
            {
                durationMs: 200,
                costUsd: 0.2,
                numTurns: 2,
                usage: { inputTokens: 8, outputTokens: 3, cacheReadTokens: 0, cacheCreationTokens: 1 },
            },
        ]);

        expect(merged).toEqual({
            durationMs: 300,
            costUsd: 0.5,
            numTurns: 6,
            usage: { inputTokens: 18, outputTokens: 8, cacheReadTokens: 1, cacheCreationTokens: 3 },
        });
    });

    it("전부 null이면 합계도 null이다", () => {
        const merged = mergeAgentCallAccounting([
            { durationMs: 100, costUsd: null, numTurns: null, usage: null },
            { durationMs: 200, costUsd: null, numTurns: null, usage: null },
        ]);

        expect(merged).toEqual({ durationMs: 300, costUsd: null, numTurns: null, usage: null });
    });

    it("일부만 null이면 있는 것만 더한다", () => {
        const merged = mergeAgentCallAccounting([
            {
                durationMs: 100,
                costUsd: 0.4,
                numTurns: 3,
                usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 1, cacheCreationTokens: 2 },
            },
            { durationMs: 200, costUsd: null, numTurns: null, usage: null },
        ]);

        expect(merged).toEqual({
            durationMs: 300,
            costUsd: 0.4,
            numTurns: 3,
            usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 1, cacheCreationTokens: 2 },
        });
    });
});
