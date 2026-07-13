import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAdminSecretValid, isAuthEnforced, issueAuthToken, verifyAuthToken } from "./auth.token.js";

describe("isAuthEnforced", () => {
    const original = { mode: process.env["MONITOR_AUTH_MODE"], secret: process.env["MONITOR_AUTH_TOKEN_SECRET"] };

    afterEach(() => {
        setEnv("MONITOR_AUTH_MODE", original.mode);
        setEnv("MONITOR_AUTH_TOKEN_SECRET", original.secret);
    });

    it("모드·비밀이 모두 없으면 비활성이다(로컬 기본값)", () => {
        setEnv("MONITOR_AUTH_MODE", undefined);
        setEnv("MONITOR_AUTH_TOKEN_SECRET", undefined);
        expect(isAuthEnforced()).toBe(false);
    });

    it("모드만 켜고 비밀이 없으면 여전히 비활성이다", () => {
        setEnv("MONITOR_AUTH_MODE", "token");
        setEnv("MONITOR_AUTH_TOKEN_SECRET", undefined);
        expect(isAuthEnforced()).toBe(false);
    });

    it("모드와 비밀이 함께 있으면 활성이다", () => {
        setEnv("MONITOR_AUTH_MODE", "token");
        setEnv("MONITOR_AUTH_TOKEN_SECRET", "s3cret");
        expect(isAuthEnforced()).toBe(true);
    });
});

describe("issueAuthToken·verifyAuthToken", () => {
    beforeEach(() => {
        setEnv("MONITOR_AUTH_TOKEN_SECRET", "s3cret");
    });
    afterEach(() => {
        setEnv("MONITOR_AUTH_TOKEN_SECRET", undefined);
    });

    it("발급한 토큰을 같은 용도로 검증하면 userId를 돌려준다", () => {
        const token = issueAuthToken({ userId: "u1", purpose: "api", ttlMs: null });
        expect(verifyAuthToken(token, "api")).toBe("u1");
    });

    it("용도가 다르면 거부한다(세션·API 토큰 혼동 방지)", () => {
        const token = issueAuthToken({ userId: "u1", purpose: "session", ttlMs: null });
        expect(verifyAuthToken(token, "api")).toBeNull();
    });

    it("만료 시각이 지나면 거부한다", () => {
        const now = new Date("2026-01-01T00:00:00.000Z");
        const token = issueAuthToken({ userId: "u1", purpose: "session", ttlMs: 1000, now });
        expect(verifyAuthToken(token, "session", new Date(now.getTime() + 500))).toBe("u1");
        expect(verifyAuthToken(token, "session", new Date(now.getTime() + 1500))).toBeNull();
    });

    it("만료 없음(ttlMs null)은 시간이 지나도 유효하다", () => {
        const now = new Date("2026-01-01T00:00:00.000Z");
        const token = issueAuthToken({ userId: "u1", purpose: "api", ttlMs: null, now });
        expect(verifyAuthToken(token, "api", new Date(now.getTime() + 365 * 24 * 3600_000))).toBe("u1");
    });

    it("서명이 변조되면 거부한다", () => {
        const token = issueAuthToken({ userId: "u1", purpose: "api", ttlMs: null });
        const tampered = `${token.slice(0, -2)}xx`;
        expect(verifyAuthToken(tampered, "api")).toBeNull();
    });

    it("다른 비밀로 발급된 토큰은 거부한다", () => {
        const token = issueAuthToken({ userId: "u1", purpose: "api", ttlMs: null });
        setEnv("MONITOR_AUTH_TOKEN_SECRET", "different-secret");
        expect(verifyAuthToken(token, "api")).toBeNull();
    });

    it("형식이 깨진 토큰은 거부한다", () => {
        expect(verifyAuthToken("not-a-token", "api")).toBeNull();
        expect(verifyAuthToken("mt1.onlytwoparts", "api")).toBeNull();
    });

    it("비밀이 없으면 검증도 거부한다", () => {
        const token = issueAuthToken({ userId: "u1", purpose: "api", ttlMs: null });
        setEnv("MONITOR_AUTH_TOKEN_SECRET", undefined);
        expect(verifyAuthToken(token, "api")).toBeNull();
    });

    it("비밀이 없으면 발급이 실패한다", () => {
        setEnv("MONITOR_AUTH_TOKEN_SECRET", undefined);
        expect(() => issueAuthToken({ userId: "u1", purpose: "api", ttlMs: null })).toThrow();
    });
});

describe("isAdminSecretValid", () => {
    afterEach(() => {
        setEnv("MONITOR_AUTH_TOKEN_SECRET", undefined);
    });

    it("설정된 비밀과 일치하면 유효하다", () => {
        setEnv("MONITOR_AUTH_TOKEN_SECRET", "s3cret");
        expect(isAdminSecretValid("s3cret")).toBe(true);
    });

    it("비밀이 다르면 무효다", () => {
        setEnv("MONITOR_AUTH_TOKEN_SECRET", "s3cret");
        expect(isAdminSecretValid("wrong")).toBe(false);
    });

    it("비밀이 설정되지 않았으면 어떤 값도 무효다", () => {
        setEnv("MONITOR_AUTH_TOKEN_SECRET", undefined);
        expect(isAdminSecretValid("anything")).toBe(false);
    });

    it("후보가 없으면 무효다", () => {
        setEnv("MONITOR_AUTH_TOKEN_SECRET", "s3cret");
        expect(isAdminSecretValid(undefined)).toBe(false);
    });
});

function setEnv(key: string, value: string | undefined): void {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
}
