import {DEFAULT_USER_ID, MONITOR_USER_HEADER} from "@monitor/kernel/user/user.header.const.js";
import {describe, expect, it} from "vitest";
import {monitorUserHeaders, resolveMonitorIdentity} from "~runtime/config/monitor.identity.js";

const NO_ENV: NodeJS.ProcessEnv = {};

describe("모니터 신원 해석", () => {
    it("아무것도 없으면 기본 사용자와 로컬 주소로 떨어진다", () => {
        const identity = resolveMonitorIdentity(NO_ENV, {});

        expect(identity.userId).toBe(DEFAULT_USER_ID);
        expect(identity.baseUrl).toBe("http://127.0.0.1:3847");
        expect(identity.userIdOrigin).toBe("default");
        expect(identity.baseUrlOrigin).toBe("default");
    });

    it("설정 파일이 기본값을 이긴다", () => {
        const identity = resolveMonitorIdentity(NO_ENV, {
            userId: "team@example.com",
            baseUrl: "https://tracer.example.com/",
        });

        expect(identity.userId).toBe("team@example.com");
        expect(identity.baseUrl).toBe("https://tracer.example.com");
        expect(identity.userIdOrigin).toBe("file");
        expect(identity.baseUrlOrigin).toBe("file");
    });

    it("환경변수가 설정 파일을 이긴다", () => {
        const identity = resolveMonitorIdentity(
            {MONITOR_USER_EMAIL: "env@example.com", MONITOR_PORT: "9999"},
            {userId: "file@example.com", baseUrl: "https://file.example.com"},
        );

        expect(identity.userId).toBe("env@example.com");
        expect(identity.baseUrl).toBe("http://127.0.0.1:9999");
        expect(identity.userIdOrigin).toBe("env");
        expect(identity.baseUrlOrigin).toBe("env");
    });

    // 서버가 헤더 없는 요청을 기본 사용자로 떨어뜨리므로 기본 신원은 헤더를 붙이지 않는다.
    it("기본 신원이면 헤더를 붙이지 않고 그 외에는 붙인다", () => {
        expect(monitorUserHeaders(resolveMonitorIdentity(NO_ENV, {}))).toEqual({});
        expect(monitorUserHeaders(resolveMonitorIdentity(NO_ENV, {userId: "a@b.com"}))).toEqual({
            [MONITOR_USER_HEADER]: "a@b.com",
        });
    });
});
