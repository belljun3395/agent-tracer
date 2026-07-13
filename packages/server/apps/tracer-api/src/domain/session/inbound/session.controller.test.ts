import { afterEach, describe, expect, it } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import type { Response } from "express";
import { issueAuthToken } from "@monitor/platform";
import { SessionController } from "./session.controller.js";
import { MONITOR_SESSION_COOKIE } from "~tracer-api/support/session.const.js";

function fakeResponse(): { readonly res: Response; readonly headers: Record<string, string> } {
    const headers: Record<string, string> = {};
    const res = { setHeader: (name: string, value: string) => { headers[name] = value; } } as unknown as Response;
    return { res, headers };
}

afterEach(() => {
    delete process.env["MONITOR_AUTH_MODE"];
    delete process.env["MONITOR_AUTH_TOKEN_SECRET"];
});

function enforceAuth(): void {
    process.env["MONITOR_AUTH_MODE"] = "token";
    process.env["MONITOR_AUTH_TOKEN_SECRET"] = "test-secret-that-is-long-enough-000000";
}

describe("SessionController", () => {
    it("유효한 발급 토큰을 세션 쿠키로 바꿔준다", () => {
        enforceAuth();
        const token = issueAuthToken({ userId: "u1", purpose: "api", ttlMs: null });
        const { res, headers } = fakeResponse();

        const result = new SessionController().create(`Bearer ${token}`, res);

        expect(result.userId).toBe("u1");
        expect(headers["Set-Cookie"]).toContain(`${MONITOR_SESSION_COOKIE}=`);
        expect(headers["Set-Cookie"]).toContain("HttpOnly");
    });

    it("토큰이 없으면 세션을 발급하지 않는다", () => {
        enforceAuth();
        const { res } = fakeResponse();

        expect(() => new SessionController().create(undefined, res)).toThrow(UnauthorizedException);
    });

    it("세션 용도 토큰을 베어러로 내밀어도 세션을 발급하지 않는다", () => {
        enforceAuth();
        const sessionToken = issueAuthToken({ userId: "u1", purpose: "session", ttlMs: null });
        const { res } = fakeResponse();

        expect(() => new SessionController().create(`Bearer ${sessionToken}`, res)).toThrow(UnauthorizedException);
    });

    it("인증이 꺼져 있으면 세션 발급 자체가 필요 없다", () => {
        const { res } = fakeResponse();

        expect(() => new SessionController().create("Bearer whatever", res)).toThrow(UnauthorizedException);
    });
});
