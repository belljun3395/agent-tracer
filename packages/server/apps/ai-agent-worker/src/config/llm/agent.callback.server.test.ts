import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentCallbackServer } from "./agent.callback.server.js";
import type { CompletionInbox, CompletionInboxEntry } from "./durable.completion.inbox.js";

const PORT = 18_812;
const BASE = `http://127.0.0.1:${PORT}`;

class FakeCompletionInbox implements CompletionInbox {
    private readonly delivered = new Set<string>();

    async open(): Promise<never> {
        throw new Error("not used by callback server");
    }

    async find(): Promise<CompletionInboxEntry | null> {
        return null;
    }

    async accept(token: string): Promise<"accepted" | "duplicate" | "unknown"> {
        if (token === "unknown") return "unknown";
        if (this.delivered.has(token)) return "duplicate";
        this.delivered.add(token);
        return "accepted";
    }

    async close(): Promise<void> {}
}

describe("AgentCallbackServer", () => {
    // fetch가 keep-alive 풀에 남긴 소켓이 닫힌 서버를 가리킨 채 재사용되므로 서버를 한 번만 열고 닫는다.
    const server = new AgentCallbackServer(PORT, BASE, "worker-1", new FakeCompletionInbox());

    beforeAll(async () => {
        await server.start();
    });

    afterAll(async () => {
        await server.close();
    });

    async function post(path: string, body: unknown): Promise<Response> {
        return fetch(`${BASE}${path}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });
    }

    it("도구 창구는 발급한 토큰의 핸들러로만 호출을 넘긴다", async () => {
        const grant = server.grantTools({ get_task_summary: async () => "요약" });

        const res = await post("/tools/invoke", { token: grant.token, name: "get_task_summary", args: {} });

        expect(await res.json()).toEqual({ content: "요약" });
    });

    it("완료 창구는 결과를 inbox에 한 번만 수락한다", async () => {
        const res = await post("/runs/complete", { token: "done-1", response: { data: { title: "제목" } } });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ accepted: true });
    });

    it("같은 실행의 결과를 두 번 보내면 두 번째는 받지 않는다", async () => {
        await post("/runs/complete", { token: "done-2", response: { data: {} } });
        const second = await post("/runs/complete", { token: "done-2", response: { data: {} } });

        expect(second.status).toBe(200);
        expect(await second.json()).toEqual({ accepted: true, duplicate: true });
    });

    it("발급하지 않은 토큰의 완료 통지는 거절한다", async () => {
        const res = await post("/runs/complete", { token: "unknown", response: {} });

        expect(res.status).toBe(403);
    });

    it("회수한 도구 창구의 토큰은 더 받지 않는다", async () => {
        const grant = server.grantTools({ get_task_summary: async () => "요약" });
        grant.revoke();

        const res = await post("/tools/invoke", { token: grant.token, name: "get_task_summary", args: {} });

        expect(res.status).toBe(403);
    });
});
