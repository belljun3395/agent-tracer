import { describe, expect, it } from "vitest";
import { LlmJobBroker } from "./llm.job.broker.js";

describe("LlmJobBroker", () => {
    it("resolves the enqueued promise when a worker reports a result", async () => {
        const broker = new LlmJobBroker();
        const pending = broker.enqueue<{ ok: boolean }>("rule-suggestion", { prompt: "hi" });

        const job = broker.claimNext();
        expect(job).not.toBeNull();
        if (!job) return;
        expect(job.kind).toBe("rule-suggestion");
        expect(job.input).toEqual({ prompt: "hi" });

        expect(broker.resolve(job.id, { ok: true })).toBe(true);
        await expect(pending).resolves.toEqual({ ok: true });
    });

    it("rejects the enqueued promise when a worker reports failure", async () => {
        const broker = new LlmJobBroker();
        const pending = broker.enqueue("task-cleanup", {});

        const job = broker.claimNext();
        expect(job).not.toBeNull();
        if (!job) return;
        expect(broker.reject(job.id, "boom")).toBe(true);

        await expect(pending).rejects.toThrow("boom");
    });

    it("hands out jobs FIFO and returns null once drained", async () => {
        const broker = new LlmJobBroker();
        const a = broker.enqueue("a", {});
        const b = broker.enqueue("b", {});

        const first = broker.claimNext();
        const second = broker.claimNext();
        expect(first?.kind).toBe("a");
        expect(second?.kind).toBe("b");
        expect(broker.claimNext()).toBeNull();

        // settle the pending promises so the test leaves nothing hanging
        if (first) broker.resolve(first.id, null);
        if (second) broker.resolve(second.id, null);
        await Promise.all([a, b]);
    });

    it("ignores resolve/reject for unknown or expired jobs", () => {
        const broker = new LlmJobBroker();
        expect(broker.resolve("nope", {})).toBe(false);
        expect(broker.reject("nope", "x")).toBe(false);
    });
});
