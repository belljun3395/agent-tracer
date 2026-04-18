import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createRuntimeHarness } from "../test-helpers.js";
describe("POST /api/assistant-response", () => {
    let runtime: Awaited<ReturnType<typeof createRuntimeHarness>>;
    beforeEach(async () => {
        runtime = await createRuntimeHarness();
    });
    afterEach(async () => {
        await runtime.close();
    });
    it("kind=assistant.response 이벤트를 기록한다", async () => {
        const started = await request(runtime.app)
            .post("/api/task-start")
            .send({ title: "assistant response test" });
        const taskId = started.body.task.id as string;
        const res = await request(runtime.app)
            .post("/api/assistant-response")
            .send({
            taskId,
            messageId: "msg-001",
            source: "claude-plugin",
            title: "I'll fix the bug now",
            body: "I'll fix the bug now by editing the relevant file.",
            metadata: { stopReason: "end_turn", inputTokens: 100, outputTokens: 50 }
        });
        expect(res.status).toBe(200);
        expect(res.body.events).toHaveLength(1);
        expect(res.body.events[0].kind).toBe("assistant.response");
    });
    it("body 없이도 이벤트를 기록한다", async () => {
        const started = await request(runtime.app)
            .post("/api/task-start")
            .send({ title: "no body test" });
        const res = await request(runtime.app)
            .post("/api/assistant-response")
            .send({
            taskId: started.body.task.id,
            messageId: "msg-002",
            source: "claude-plugin",
            title: "Response (end_turn)"
        });
        expect(res.status).toBe(200);
        expect(res.body.events[0].kind).toBe("assistant.response");
    });
    it("sessionId 없이도 이벤트를 기록한다", async () => {
        const started = await request(runtime.app)
            .post("/api/task-start")
            .send({ title: "no session test" });
        const res = await request(runtime.app)
            .post("/api/assistant-response")
            .send({
            taskId: started.body.task.id,
            messageId: "msg-003",
            source: "claude-plugin",
            title: "Some response"
        });
        expect(res.status).toBe(200);
        expect(res.body.events).toHaveLength(1);
    });
    it("taskId 누락 시 400을 반환한다", async () => {
        const res = await request(runtime.app)
            .post("/api/assistant-response")
            .send({ messageId: "x", source: "test", title: "t" });
        expect(res.status).toBe(400);
    });
    it("messageId 누락 시 400을 반환한다", async () => {
        const res = await request(runtime.app)
            .post("/api/assistant-response")
            .send({ taskId: "t", source: "test", title: "t" });
        expect(res.status).toBe(400);
    });
    it("title 누락 시 400을 반환한다", async () => {
        const res = await request(runtime.app)
            .post("/api/assistant-response")
            .send({ taskId: "t", messageId: "m", source: "test" });
        expect(res.status).toBe(400);
    });
    it("source 누락 시 400을 반환한다", async () => {
        const res = await request(runtime.app)
            .post("/api/assistant-response")
            .send({ taskId: "t", messageId: "m", title: "test" });
        expect(res.status).toBe(400);
    });
    it("messageId와 source를 metadata에 병합한다", async () => {
        const started = await request(runtime.app)
            .post("/api/task-start")
            .send({ title: "metadata merge test" });
        const res = await request(runtime.app)
            .post("/api/assistant-response")
            .send({
            taskId: started.body.task.id,
            messageId: "msg-meta-001",
            source: "claude-plugin",
            title: "Metadata test response",
            metadata: { stopReason: "stop", outputTokens: 200 }
        });
        expect(res.status).toBe(200);
        expect(res.body.events[0].kind).toBe("assistant.response");
    });
});
