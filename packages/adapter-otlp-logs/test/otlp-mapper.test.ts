import { describe, it, expect } from "vitest";
import { extractApiRequestRecords } from "../src/otlp-mapper.js";
import type { OtlpApiRequestRecord } from "../src/otlp-mapper.js";
import type { OtlpLogsRequest } from "../src/schemas.otlp.js";

const validRequest: OtlpLogsRequest = {
    resourceLogs: [
        {
            resource: {
                attributes: [
                    { key: "service.name", value: { stringValue: "claude-code" } },
                    { key: "session.id", value: { stringValue: "sid_abc" } },
                ],
            },
            scopeLogs: [
                {
                    scope: { name: "com.anthropic.claude_code" },
                    logRecords: [
                        {
                            timeUnixNano: "1745000000000000000",
                            body: { stringValue: "claude_code.api_request" },
                            attributes: [
                                { key: "event.name", value: { stringValue: "api_request" } },
                                { key: "session.id", value: { stringValue: "sid_abc" } },
                                { key: "model", value: { stringValue: "claude-sonnet-4-6" } },
                                { key: "input_tokens", value: { intValue: "1234" } },
                                { key: "output_tokens", value: { intValue: "567" } },
                                { key: "cache_read_tokens", value: { intValue: "100" } },
                                { key: "cache_creation_tokens", value: { intValue: "50" } },
                                { key: "cost_usd", value: { doubleValue: 0.025 } },
                                { key: "duration_ms", value: { intValue: "1500" } },
                                { key: "prompt.id", value: { stringValue: "prompt_xyz" } },
                            ],
                        },
                        {
                            // Non-api_request record — should be ignored
                            attributes: [
                                { key: "event.name", value: { stringValue: "user_prompt" } },
                                { key: "session.id", value: { stringValue: "sid_abc" } },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
};

describe("extractApiRequestRecords", () => {
    it("extracts api_request records with correct token fields", () => {
        const records = extractApiRequestRecords(validRequest);
        expect(records).toHaveLength(1);
        const rec = records[0]!;
        expect(rec.sessionId).toBe("sid_abc");
        expect(rec.model).toBe("claude-sonnet-4-6");
        expect(rec.inputTokens).toBe(1234);
        expect(rec.outputTokens).toBe(567);
        expect(rec.cacheReadTokens).toBe(100);
        expect(rec.cacheCreateTokens).toBe(50);
        expect(rec.costUsd).toBeCloseTo(0.025);
        expect(rec.durationMs).toBe(1500);
        expect(rec.promptId).toBe("prompt_xyz");
    });

    it("skips non-api_request records", () => {
        const records = extractApiRequestRecords(validRequest);
        expect(records.every((r: OtlpApiRequestRecord) => r.inputTokens !== undefined)).toBe(true);
    });

    it("returns empty array for empty resourceLogs", () => {
        const records = extractApiRequestRecords({ resourceLogs: [] });
        expect(records).toHaveLength(0);
    });

    it("falls back to resource-level session.id when record attributes lack it", () => {
        const req: OtlpLogsRequest = {
            resourceLogs: [
                {
                    resource: { attributes: [{ key: "session.id", value: { stringValue: "res_sid" } }] },
                    scopeLogs: [{
                        logRecords: [{
                            attributes: [
                                { key: "event.name", value: { stringValue: "api_request" } },
                                { key: "input_tokens", value: { intValue: "10" } },
                                { key: "output_tokens", value: { intValue: "5" } },
                            ],
                        }],
                    }],
                },
            ],
        };
        const records = extractApiRequestRecords(req);
        expect(records[0]?.sessionId).toBe("res_sid");
    });
});
