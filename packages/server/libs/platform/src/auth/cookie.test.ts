import { describe, expect, it } from "vitest";
import { clearedSessionCookie, parseCookie, serializeSessionCookie } from "./cookie.js";

describe("parseCookie", () => {
    it("여러 쿠키 중 이름이 일치하는 값을 찾는다", () => {
        expect(parseCookie("a=1; monitor_session=abc; b=2", "monitor_session")).toBe("abc");
    });

    it("URL 인코딩된 값을 복원한다", () => {
        expect(parseCookie("monitor_session=a%20b", "monitor_session")).toBe("a b");
    });

    it("헤더가 없으면 null을 준다", () => {
        expect(parseCookie(undefined, "monitor_session")).toBeNull();
    });

    it("이름이 없으면 null을 준다", () => {
        expect(parseCookie("a=1; b=2", "monitor_session")).toBeNull();
    });
});

describe("serializeSessionCookie·clearedSessionCookie", () => {
    it("HttpOnly·SameSite=Lax·Max-Age를 포함한다", () => {
        const cookie = serializeSessionCookie("monitor_session", "abc", { maxAgeSeconds: 100, secure: false });
        expect(cookie).toContain("monitor_session=abc");
        expect(cookie).toContain("HttpOnly");
        expect(cookie).toContain("SameSite=Lax");
        expect(cookie).toContain("Max-Age=100");
        expect(cookie).not.toContain("Secure");
    });

    it("secure가 true면 Secure 속성을 붙인다", () => {
        expect(serializeSessionCookie("monitor_session", "abc", { maxAgeSeconds: 1, secure: true })).toContain("Secure");
    });

    it("만료 쿠키는 Max-Age=0으로 값을 비운다", () => {
        const cleared = clearedSessionCookie("monitor_session", false);
        expect(cleared).toContain("monitor_session=");
        expect(cleared).toContain("Max-Age=0");
    });
});
