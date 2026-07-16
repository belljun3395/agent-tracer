import http from "node:http";
import {afterEach, describe, expect, it} from "vitest";
import {createResumeHttpHandler} from "~runtime/daemon/control/resume.http.js";
import {CONTROL_TOKEN_HEADER, isAllowedLoopbackOrigin} from "~runtime/daemon/control/loopback.http.js";

const TOKEN = "test-resume-token";

let servers: http.Server[] = [];

afterEach(async () => {
    await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
    servers = [];
});

async function listen(handler: http.RequestListener): Promise<string> {
    const server = http.createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("unexpected server address");
    return `http://127.0.0.1:${address.port}`;
}

describe("isAllowedLoopbackOrigin", () => {
    it("loopback origin만 허용한다", () => {
        expect(isAllowedLoopbackOrigin("http://127.0.0.1:5173")).toBe(true);
        expect(isAllowedLoopbackOrigin("http://localhost:5173")).toBe(true);
        expect(isAllowedLoopbackOrigin("https://example.com")).toBe(false);
    });
});

describe("createResumeHttpHandler", () => {
    it("올바른 토큰의 재개 요청을 실행기로 넘긴다", async () => {
        const calls: unknown[] = [];
        const baseUrl = await listen(createResumeHttpHandler(TOKEN, async (request) => {
            calls.push(request);
            return {command: "claude --resume 'abc'"};
        }));

        const response = await fetch(`${baseUrl}/api/v1/resume`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                origin: "http://127.0.0.1:5173",
                [CONTROL_TOKEN_HEADER]: TOKEN,
            },
            body: JSON.stringify({
                taskId: "task-1",
                runtimeSource: "claude-plugin",
                runtimeSessionId: "abc",
                workspacePath: "/repo",
            }),
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ok: true, command: "claude --resume 'abc'"});
        expect(calls).toEqual([{
            taskId: "task-1",
            runtimeSource: "claude-plugin",
            runtimeSessionId: "abc",
            workspacePath: "/repo",
        }]);
    });

    it("토큰 없는 요청은 거부한다", async () => {
        const launcherCalls: unknown[] = [];
        const baseUrl = await listen(createResumeHttpHandler(TOKEN, async (request) => {
            launcherCalls.push(request);
            return {command: ""};
        }));

        const response = await fetch(`${baseUrl}/api/v1/resume`, {
            method: "POST",
            headers: {"content-type": "application/json", origin: "http://127.0.0.1:5173"},
            body: JSON.stringify({runtimeSource: "claude-plugin", runtimeSessionId: "abc"}),
        });

        expect(response.status).toBe(401);
        expect((await response.json()) as {error: {code: string}}).toMatchObject({
            ok: false,
            error: {code: "missing_token"},
        });
        expect(launcherCalls).toHaveLength(0);
    });

    it("잘못된 토큰의 요청은 거부한다", async () => {
        const baseUrl = await listen(createResumeHttpHandler(TOKEN, async () => ({command: ""})));

        const response = await fetch(`${baseUrl}/api/v1/resume`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                origin: "http://127.0.0.1:5173",
                [CONTROL_TOKEN_HEADER]: "wrong-token",
            },
            body: JSON.stringify({runtimeSource: "claude-plugin", runtimeSessionId: "abc"}),
        });

        expect(response.status).toBe(401);
        expect((await response.json()) as {error: {code: string}}).toMatchObject({
            ok: false,
            error: {code: "invalid_token"},
        });
    });

    it("loopback이 아닌 origin은 토큰과 무관하게 거부한다", async () => {
        const baseUrl = await listen(createResumeHttpHandler(TOKEN, async () => ({command: ""})));

        const response = await fetch(`${baseUrl}/api/v1/resume`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                origin: "https://example.com",
                [CONTROL_TOKEN_HEADER]: TOKEN,
            },
            body: "{}",
        });

        expect(response.status).toBe(403);
    });
});
