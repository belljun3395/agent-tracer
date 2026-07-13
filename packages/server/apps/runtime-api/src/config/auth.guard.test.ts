import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { issueAuthToken } from "@monitor/platform";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import { AuthGuard } from "./auth.guard.js";

function contextOf(headers: Record<string, string | undefined>): ExecutionContext {
    const request = { headers: { ...headers } };
    return {
        getType: () => "http",
        switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
        getHandler: () => function handler() {},
        getClass: () => class Controller {},
    } as unknown as ExecutionContext;
}

describe("AuthGuard", () => {
    const originalMode = process.env["MONITOR_AUTH_MODE"];
    const originalSecret = process.env["MONITOR_AUTH_TOKEN_SECRET"];

    beforeEach(() => {
        process.env["MONITOR_AUTH_MODE"] = "token";
        process.env["MONITOR_AUTH_TOKEN_SECRET"] = "s3cret";
    });

    afterEach(() => {
        if (originalMode === undefined) delete process.env["MONITOR_AUTH_MODE"];
        else process.env["MONITOR_AUTH_MODE"] = originalMode;
        if (originalSecret === undefined) delete process.env["MONITOR_AUTH_TOKEN_SECRET"];
        else process.env["MONITOR_AUTH_TOKEN_SECRET"] = originalSecret;
    });

    it("인증이 꺼져 있으면 자기신고 헤더를 그대로 통과시킨다", () => {
        delete process.env["MONITOR_AUTH_MODE"];
        const guard = new AuthGuard(new Reflector());

        expect(guard.canActivate(contextOf({ [MONITOR_USER_HEADER]: "anyone" }))).toBe(true);
    });

    it("인증이 켜졌는데 베어러 토큰이 없으면 거부한다", () => {
        const guard = new AuthGuard(new Reflector());

        expect(() => guard.canActivate(contextOf({}))).toThrow();
    });

    it("유효한 토큰이면 검증된 userId로 헤더를 덮어쓴다", () => {
        const guard = new AuthGuard(new Reflector());
        const token = issueAuthToken({ userId: "owner", purpose: "api", ttlMs: null });
        const headers: Record<string, string | undefined> = { authorization: `Bearer ${token}` };
        const request = { headers };
        const context = {
            getType: () => "http",
            switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
            getHandler: () => function handler() {},
            getClass: () => class Controller {},
        } as unknown as ExecutionContext;

        expect(guard.canActivate(context)).toBe(true);
        expect(headers[MONITOR_USER_HEADER]).toBe("owner");
    });

    it("남의 userId를 자기신고하면 토큰 소유자와 달라 거부한다", () => {
        const guard = new AuthGuard(new Reflector());
        const token = issueAuthToken({ userId: "owner", purpose: "api", ttlMs: null });

        expect(() => guard.canActivate(contextOf({
            authorization: `Bearer ${token}`,
            [MONITOR_USER_HEADER]: "victim",
        }))).toThrow();
    });

    it("SkipGate가 붙은 경로는 인증 없이 통과한다", () => {
        const reflector = new Reflector();
        reflector.getAllAndOverride = () => true;
        const guard = new AuthGuard(reflector);

        expect(guard.canActivate(contextOf({}))).toBe(true);
    });
});
