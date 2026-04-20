import { describe, expect, it } from "vitest";
import {
    applyRolloutPayloadToObserverState,
    type ObserverState,
} from "./observe.js";

function createBaseState(): ObserverState {
    return {
        modelId: "gpt-5.4",
        modelProvider: "openai",
        tokenUsage: undefined,
        rateLimits: undefined,
        turnId: undefined,
        observedThreadId: "thr_123",
    };
}

describe("applyRolloutPayloadToObserverState", () => {
    it("writes tokenUsage and signals emit", () => {
        const state = createBaseState();

        const changed = applyRolloutPayloadToObserverState({
            kind: "tokenCount",
            tokenUsage: {
                total: { totalTokens: 50314, inputTokens: 49195, cachedInputTokens: 4480, outputTokens: 1119, reasoningOutputTokens: 516 },
                last: { totalTokens: 50314, inputTokens: 49195, cachedInputTokens: 4480, outputTokens: 1119, reasoningOutputTokens: 516 },
                modelContextWindow: 950000,
            },
            rateLimits: undefined,
        }, state);

        expect(changed).toBe(true);
        expect(state.tokenUsage?.total.totalTokens).toBe(50314);
        expect(state.tokenUsage?.modelContextWindow).toBe(950000);
    });

    it("writes rateLimits and signals emit", () => {
        const state = createBaseState();

        const changed = applyRolloutPayloadToObserverState({
            kind: "tokenCount",
            tokenUsage: undefined,
            rateLimits: {
                limitId: "codex",
                limitName: null,
                primary: { usedPercent: 6.0, windowDurationMins: 300, resetsAt: 1776691885 },
                secondary: null,
            },
        }, state);

        expect(changed).toBe(true);
        expect(state.rateLimits?.primary?.usedPercent).toBe(6.0);
    });

    it("does not signal emit when tokenCount payload has neither field", () => {
        const state = createBaseState();

        const changed = applyRolloutPayloadToObserverState({
            kind: "tokenCount",
            tokenUsage: undefined,
            rateLimits: undefined,
        }, state);

        expect(changed).toBe(false);
        expect(state.tokenUsage).toBeUndefined();
        expect(state.rateLimits).toBeUndefined();
    });

    it("updates modelId and turnId from a turnContext event", () => {
        const state: ObserverState = {
            modelId: undefined,
            modelProvider: "openai",
            tokenUsage: undefined,
            rateLimits: undefined,
            turnId: undefined,
            observedThreadId: "thr_123",
        };

        const changed = applyRolloutPayloadToObserverState({
            kind: "turnContext",
            turnId: "019dab0c-22dd-74d3-9d14-6945c7128024",
            modelId: "gpt-5.4",
        }, state);

        expect(changed).toBe(true);
        expect(state.modelId).toBe("gpt-5.4");
        expect(state.turnId).toBe("019dab0c-22dd-74d3-9d14-6945c7128024");
    });

    it("does not emit when turnContext repeats the current model and turn", () => {
        const state: ObserverState = {
            modelId: "gpt-5.4",
            modelProvider: "openai",
            tokenUsage: undefined,
            rateLimits: undefined,
            turnId: "t1",
            observedThreadId: "thr_123",
        };

        const changed = applyRolloutPayloadToObserverState({
            kind: "turnContext",
            turnId: "t1",
            modelId: "gpt-5.4",
        }, state);

        expect(changed).toBe(false);
    });
});
