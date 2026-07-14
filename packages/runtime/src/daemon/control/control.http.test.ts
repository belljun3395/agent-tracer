import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import type {AddressInfo} from "node:net";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ensureSpoolDir, resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {readAllSpoolLines} from "~runtime/config/spool.js";
import {InterventionLog} from "~runtime/daemon/observation/intervention.log.js";
import {RecentEventRing} from "~runtime/domain/ingest/model/recent.event.model.js";
import {createControlHttpHandler, type ControlActions} from "~runtime/daemon/control/control.http.js";
import {buildControlSnapshot, type DaemonRuntimeState} from "~runtime/daemon/control/control.state.js";
import {RESUME_TOKEN_HEADER} from "~runtime/daemon/control/resume.http.js";

const TOKEN = "test-token-0123456789";

let tmp: string;
let paths: AgentTracerPaths;
let server: http.Server;
let baseUrl: string;
let actions: ControlActions;

function state(): DaemonRuntimeState {
    return {
        version: "0.5.6",
        hookVersion: "0.3.2",
        pid: 1234,
        startedAt: Date.now() - 1000,
        entryPath: "/plugins/cache/0.5.6/dist/entry.js",
        identity: {
            userId: "local",
            baseUrl: "http://localhost:3000",
            userIdOrigin: "default",
            baseUrlOrigin: "default",
        },
        backoffMs: 0,
        retryStatusSince: null,
        lastSendAt: null,
        lastSendOutcome: null,
        lastDeadReason: null,
        poisonSegment: null,
        poisonAttempts: 0,
        poisonThreshold: 3,
        activeConnections: 0,
        lastActivityAt: Date.now(),
        idleShutdownMs: 300_000,
        swallowedErrors: 0,
        rules: [],
        caches: {
            rules: {lastRefreshAt: null, lastFailureAt: null, intervalMs: 10_000, entries: 0},
            recipes: {lastRefreshAt: null, lastFailureAt: null, intervalMs: 300_000, entries: 0},
        },
        ring: new RecentEventRing().stats(),
        interventions: new InterventionLog().snapshot(),
    };
}

async function request(
    method: string,
    url: string,
    options: {token?: string; body?: unknown} = {},
): Promise<{status: number; json: Record<string, unknown>}> {
    const headers: Record<string, string> = {"content-type": "application/json"};
    if (options.token !== undefined) headers[RESUME_TOKEN_HEADER] = options.token;
    const response = await fetch(`${baseUrl}${url}`, {
        method,
        headers,
        ...(options.body !== undefined ? {body: JSON.stringify(options.body)} : {}),
    });
    const text = await response.text();
    let json: Record<string, unknown> = {};
    try {
        json = JSON.parse(text) as Record<string, unknown>;
    } catch {
        // HTML 응답은 JSON이 아니다.
    }
    return {status: response.status, json};
}

beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "control-http-test-"));
    paths = resolveAgentTracerPaths({HOME: tmp});
    ensureSpoolDir(paths);
    actions = {
        snapshot: () => buildControlSnapshot(state(), paths),
        flush: vi.fn(),
        resetBackoff: vi.fn(),
        refreshCaches: vi.fn(),
        restart: vi.fn(),
        stop: vi.fn(),
    };
    server = http.createServer(createControlHttpHandler({token: TOKEN, actions, paths}));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmp, {recursive: true, force: true});
});

describe("데몬 제어 HTTP", () => {
    it("토큰 없이 스냅샷을 요구하면 거부한다", async () => {
        const response = await request("GET", "/api/v1/control/snapshot");

        expect(response.status).toBe(401);
    });

    it("틀린 토큰을 거부한다", async () => {
        const response = await request("GET", "/api/v1/control/snapshot", {token: "wrong-token-000000000"});

        expect(response.status).toBe(401);
    });

    it("토큰을 제시하면 스냅샷을 돌려준다", async () => {
        const response = await request("GET", "/api/v1/control/snapshot", {token: TOKEN});

        expect(response.status).toBe(200);
        expect(response.json["ok"]).toBe(true);
    });

    it("훅 버전과 데몬 버전이 다르면 스냅샷이 스큐를 표시한다", async () => {
        const response = await request("GET", "/api/v1/control/snapshot", {token: TOKEN});

        const data = response.json["data"] as Record<string, unknown>;
        expect(data["versionSkew"]).toBe(true);
    });

    it("제어 페이지는 토큰 없이 열리되 프레임에 실리지 않는다", async () => {
        const response = await fetch(`${baseUrl}/`);

        expect(response.status).toBe(200);
        expect(response.headers.get("x-frame-options")).toBe("DENY");
        expect(await response.text()).toContain("Daemon control");
    });

    it("플러시를 지시하면 데몬 동작을 호출한다", async () => {
        const response = await request("POST", "/api/v1/control/flush", {token: TOKEN});

        expect(response.status).toBe(200);
        expect(actions.flush).toHaveBeenCalledOnce();
    });

    it("백오프 리셋을 지시하면 데몬 동작을 호출한다", async () => {
        await request("POST", "/api/v1/control/reset-backoff", {token: TOKEN});

        expect(actions.resetBackoff).toHaveBeenCalledOnce();
    });

    it("dead-letter를 kind로 골라 되돌린다", async () => {
        fs.writeFileSync(paths.deadPath, [
            JSON.stringify({id: "1", kind: "execute_tool", taskId: "t", occurredAt: ""}),
            JSON.stringify({id: "2", kind: "agent_tracer.user.message", taskId: "t", occurredAt: ""}),
        ].join("\n") + "\n");

        const response = await request("POST", "/api/v1/control/dead-letter/requeue", {
            token: TOKEN,
            body: {kinds: ["agent_tracer.user.message"]},
        });

        expect(response.json["data"]).toEqual({moved: 1, remaining: 1});
        expect(readAllSpoolLines(paths)).toHaveLength(1);
        expect(actions.flush).toHaveBeenCalledOnce();
    });

    it("dead-letter를 비우면 스풀로 되돌리지 않는다", async () => {
        fs.writeFileSync(paths.deadPath, `${JSON.stringify({id: "1", kind: "a", taskId: "t", occurredAt: ""})}\n`);

        const response = await request("POST", "/api/v1/control/dead-letter/purge", {token: TOKEN});

        expect(response.json["data"]).toEqual({moved: 1, remaining: 0});
        expect(readAllSpoolLines(paths)).toHaveLength(0);
    });

    it("알 수 없는 경로는 404를 낸다", async () => {
        expect((await request("GET", "/api/v1/control/nope", {token: TOKEN})).status).toBe(404);
    });

    it("스냅샷 경로에 POST하면 405를 낸다", async () => {
        expect((await request("POST", "/api/v1/control/snapshot", {token: TOKEN})).status).toBe(405);
    });
});
