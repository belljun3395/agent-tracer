import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentCallbackServer } from "./agent.callback.server.js";

const PORT = 18_812;
const BASE = `http://127.0.0.1:${PORT}`;

describe("AgentCallbackServer", () => {
    // fetch는 응답을 받은 소켓을 keep-alive 풀에 남긴다. 테스트마다 서버를 닫고 다시 열면
    // 그 소켓이 닫힌 서버를 가리킨 채 재사용되어 요청이 소켓 오류로 끊긴다.
    const server = new AgentCallbackServer(PORT, BASE, "worker-1");

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

    it("완료 창구는 발급한 토큰의 실행에 결과를 넘긴다", async () => {
        const received: Record<string, unknown>[] = [];
        const grant = server.grantCompletion((response) => received.push(response));

        const res = await post("/runs/complete", { token: grant.token, response: { data: { title: "제목" } } });

        expect(res.status).toBe(200);
        expect(received).toEqual([{ data: { title: "제목" } }]);
    });

    it("같은 실행의 결과를 두 번 보내면 두 번째는 받지 않는다", async () => {
        const received: Record<string, unknown>[] = [];
        const grant = server.grantCompletion((response) => received.push(response));

        await post("/runs/complete", { token: grant.token, response: { data: {} } });
        const second = await post("/runs/complete", { token: grant.token, response: { data: {} } });

        expect(second.status).toBe(403);
        expect(received).toHaveLength(1);
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
