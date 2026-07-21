import { describe, expect, it } from "vitest";
import { AgentExecutionFailure, isBudgetExhaustedFailure } from "./agent.error.js";

describe("isBudgetExhaustedFailure", () => {
    it("턴 예산 소진 실패를 예산 소진으로 본다", () => {
        const error = new AgentExecutionFailure("agent", "AGENT_FAILED", "boom", {
            errorSubtype: "max_turns_exceeded",
        });

        expect(isBudgetExhaustedFailure(error)).toBe(true);
    });

    it("비용 예산 소진 실패를 예산 소진으로 본다", () => {
        const error = new AgentExecutionFailure("agent", "AGENT_FAILED", "boom", {
            errorSubtype: "budget_exceeded",
        });

        expect(isBudgetExhaustedFailure(error)).toBe(true);
    });

    it("다른 실패 종류는 예산 소진으로 보지 않는다", () => {
        const error = new AgentExecutionFailure("agent", "OUTPUT_SCHEMA_INVALID", "boom", {
            errorSubtype: "output_schema_invalid",
        });

        expect(isBudgetExhaustedFailure(error)).toBe(false);
    });

    it("AgentExecutionFailure가 아닌 값은 예산 소진으로 보지 않는다", () => {
        expect(isBudgetExhaustedFailure(new Error("boom"))).toBe(false);
        expect(isBudgetExhaustedFailure("boom")).toBe(false);
    });
});
