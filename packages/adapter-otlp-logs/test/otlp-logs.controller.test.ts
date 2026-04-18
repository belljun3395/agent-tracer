import { describe, it, expect, vi } from "vitest";
import { HttpException } from "@nestjs/common";
import { OtlpLogsController } from "../src/otlp-logs.controller.js";
import type { OtlpLogsRequest } from "../src/schemas.otlp.js";

function makeMonitor(overrides: Record<string, unknown> = {}) {
    return {
        resolveRuntimeBinding: vi.fn().mockResolvedValue(null),
        logTokenUsage: vi.fn().mockResolvedValue({}),
        ...overrides,
    } as unknown as import("@monitor/application").MonitorService;
}

const apiRequestBody: OtlpLogsRequest = {
    resourceLogs: [{
        scopeLogs: [{
            logRecords: [{
                attributes: [
                    { key: "event.name", value: { stringValue: "api_request" } },
                    { key: "session.id", value: { stringValue: "sid_test" } },
                    { key: "input_tokens", value: { intValue: "100" } },
                    { key: "output_tokens", value: { intValue: "50" } },
                    { key: "cache_read_tokens", value: { intValue: "10" } },
                    { key: "cache_creation_tokens", value: { intValue: "5" } },
                    { key: "model", value: { stringValue: "claude-sonnet-4-6" } },
                    { key: "cost_usd", value: { doubleValue: 0.01 } },
                ],
            }],
        }],
    }],
};

describe("OtlpLogsController.receiveLogs", () => {
    it("returns 400 for invalid body", async () => {
        const ctrl = new OtlpLogsController(makeMonitor());
        await expect(ctrl.receiveLogs("not an object")).rejects.toBeInstanceOf(HttpException);
    });

    it("skips records when no runtime binding found", async () => {
        const monitor = makeMonitor({ resolveRuntimeBinding: vi.fn().mockResolvedValue(null) });
        const ctrl = new OtlpLogsController(monitor);
        const result = await ctrl.receiveLogs(apiRequestBody);
        expect(result).toEqual({ ok: true, data: { accepted: 0, skipped: 1, total: 1 } });
        expect(monitor.logTokenUsage).not.toHaveBeenCalled();
    });

    it("calls logTokenUsage when binding is found", async () => {
        const monitor = makeMonitor({
            resolveRuntimeBinding: vi.fn().mockResolvedValue({ taskId: "task_1", sessionId: "sess_1" }),
        });
        const ctrl = new OtlpLogsController(monitor);
        const result = await ctrl.receiveLogs(apiRequestBody);
        expect(result).toEqual({ ok: true, data: { accepted: 1, skipped: 0, total: 1 } });
        expect(monitor.logTokenUsage).toHaveBeenCalledOnce();
        const call = (monitor.logTokenUsage as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
        expect(call.inputTokens).toBe(100);
        expect(call.outputTokens).toBe(50);
        expect(call.model).toBe("claude-sonnet-4-6");
    });

    it("accepts empty resourceLogs and returns zero counts", async () => {
        const ctrl = new OtlpLogsController(makeMonitor());
        const result = await ctrl.receiveLogs({ resourceLogs: [] });
        expect(result).toEqual({ ok: true, data: { accepted: 0, skipped: 0, total: 0 } });
    });
});
