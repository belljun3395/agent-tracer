import { afterEach, describe, expect, it } from "vitest";
import { issueAuthToken } from "@monitor/platform";
import { authenticateUpgrade, WS_UPGRADE_REJECT } from "./ws.gateway.js";
import { MONITOR_SESSION_COOKIE } from "~tracer-api/support/session.const.js";

import type http from "node:http";

function asRequest(headers: Record<string, string>): http.IncomingMessage {
    return { headers } as unknown as http.IncomingMessage;
}

afterEach(() => {
    delete process.env["MONITOR_AUTH_MODE"];
    delete process.env["MONITOR_AUTH_TOKEN_SECRET"];
});

function enforceAuth(): void {
    process.env["MONITOR_AUTH_MODE"] = "token";
    process.env["MONITOR_AUTH_TOKEN_SECRET"] = "test-secret-that-is-long-enough-000000";
}

describe("WS upgrade 인증", () => {
    it("인증이 꺼져 있으면 기존 자기신고 경로를 그대로 둔다", () => {
        const result = authenticateUpgrade(asRequest({}));

        expect(result).toBeNull();
    });

    it("인증이 켜져 있는데 신원이 없으면 upgrade를 거부한다", () => {
        enforceAuth();

        const result = authenticateUpgrade(asRequest({}));

        expect(result).toBe(WS_UPGRADE_REJECT);
    });

    it("데몬 베어러 토큰의 신원으로 붙인다", () => {
        enforceAuth();
        const token = issueAuthToken({ userId: "u1", purpose: "api", ttlMs: null });

        const result = authenticateUpgrade(asRequest({ authorization: `Bearer ${token}` }));

        expect(result).toBe("u1");
    });

    it("브라우저 세션 쿠키의 신원으로 붙인다", () => {
        enforceAuth();
        const token = issueAuthToken({ userId: "u2", purpose: "session", ttlMs: null });

        const result = authenticateUpgrade(asRequest({ cookie: `${MONITOR_SESSION_COOKIE}=${token}` }));

        expect(result).toBe("u2");
    });

    it("세션 토큰을 베어러로 위장해도 신원을 주지 않는다", () => {
        enforceAuth();
        const sessionToken = issueAuthToken({ userId: "u3", purpose: "session", ttlMs: null });

        const result = authenticateUpgrade(asRequest({ authorization: `Bearer ${sessionToken}` }));

        expect(result).toBe(WS_UPGRADE_REJECT);
    });
});
