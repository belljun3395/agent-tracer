import { describe, expect, it } from "vitest";
import {
    applyResponseToObserverState,
    type ObserverState,
} from "./observe.js";

describe("applyResponseToObserverState", () => {
    it("requests a fresh snapshot when thread resume fills in the model", () => {
        const state: ObserverState = {
            modelId: undefined,
            modelProvider: undefined,
            tokenUsage: undefined,
            rateLimits: {
                limitId: "codex",
                limitName: null,
                primary: {
                    usedPercent: 17,
                    windowDurationMins: 300,
                    resetsAt: 1776691885,
                },
                secondary: null,
            },
            turnId: undefined,
            observedThreadId: undefined,
        };

        const shouldEmit = applyResponseToObserverState({
            id: 3,
            result: {
                model: "gpt-5.4",
                modelProvider: "openai",
            },
        }, state);

        expect(shouldEmit).toBe(true);
        expect(state.modelId).toBe("gpt-5.4");
        expect(state.modelProvider).toBe("openai");
    });

    it("does not request a snapshot when resume adds no new information", () => {
        const state: ObserverState = {
            modelId: "gpt-5.4",
            modelProvider: "openai",
            tokenUsage: undefined,
            rateLimits: undefined,
            turnId: undefined,
            observedThreadId: "thr_123",
        };

        const shouldEmit = applyResponseToObserverState({
            id: 3,
            result: {
                model: "gpt-5.4",
                modelProvider: "openai",
            },
        }, state);

        expect(shouldEmit).toBe(false);
    });
});
