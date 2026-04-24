import { describe, expect, it } from "vitest";
import { createApiSuccessEnvelope } from "./api-response-envelope.js";

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
});
