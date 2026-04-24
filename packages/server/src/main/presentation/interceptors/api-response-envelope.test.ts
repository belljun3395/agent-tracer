import { describe, expect, it } from "vitest";
import { createApiSuccessEnvelope, isApiResponsePath } from "./api-response-envelope.js";

describe("api response envelope", () => {
    it("wraps arbitrary success payloads under data", () => {
        expect(createApiSuccessEnvelope({ task: { id: "task-1" } })).toEqual({
            ok: true,
            data: {
                task: { id: "task-1" },
            },
        });
    });

    it("preserves existing success envelopes", () => {
        expect(createApiSuccessEnvelope({ ok: true, data: { taskId: "task-1" } })).toEqual({
            ok: true,
            data: { taskId: "task-1" },
        });
    });

    it("moves legacy ok-plus-payload responses under data", () => {
        expect(createApiSuccessEnvelope({ ok: true, deleted: true })).toEqual({
            ok: true,
            data: { deleted: true },
        });
    });

    it("recognizes API response paths without wrapping health or websocket endpoints", () => {
        expect(isApiResponsePath("/api")).toBe(true);
        expect(isApiResponsePath("/api/tasks")).toBe(true);
        expect(isApiResponsePath("/ingest/v1")).toBe(true);
        expect(isApiResponsePath("/ingest/v1/events")).toBe(true);
        expect(isApiResponsePath("/health")).toBe(false);
        expect(isApiResponsePath("/ws")).toBe(false);
    });
});
