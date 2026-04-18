import { describe, it, expect } from "vitest";
import { ingestEventsBatchSchema } from "../src/schemas.ingest.js";

describe("ingestEventsBatchSchema — token.usage", () => {
    it("accepts a valid token.usage event", () => {
        const result = ingestEventsBatchSchema.safeParse({
            events: [{
                kind: "token.usage",
                taskId: "task_001",
                sessionId: "sess_001",
                metadata: {
                    inputTokens: 100,
                    outputTokens: 50,
                    cacheReadTokens: 20,
                    cacheCreateTokens: 10,
                    model: "claude-sonnet-4-6",
                    source: "otlp",
                },
            }],
        });
        expect(result.success).toBe(true);
    });

    it("rejects an unknown event kind", () => {
        const result = ingestEventsBatchSchema.safeParse({
            events: [{ kind: "unknown.kind", taskId: "task_001" }],
        });
        expect(result.success).toBe(false);
    });
});
