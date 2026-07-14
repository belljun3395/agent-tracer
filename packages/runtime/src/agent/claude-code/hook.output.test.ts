import {describe, expect, it} from "vitest";
import {formatDeliveryWarning} from "~runtime/agent/claude-code/hook.output.js";

describe("formatDeliveryWarning", () => {
    it("서버에 닿고 있으면 아무 말도 하지 않는다", () => {
        const warning = formatDeliveryWarning({
            reachable: true,
            baseUrl: "http://127.0.0.1:3847",
            backlogBytes: 4096,
        });

        expect(warning).toBe("");
    });

    it("데몬이 없어 배출 상태를 모르면 경고하지 않는다", () => {
        expect(formatDeliveryWarning(null)).toBe("");
    });

    it("닿지 못하면 서버 주소와 스풀 적재량과 할 일을 말한다", () => {
        const warning = formatDeliveryWarning({
            reachable: false,
            baseUrl: "http://127.0.0.1:3847",
            backlogBytes: 2 * 1024 * 1024,
        });

        expect(warning).toContain("http://127.0.0.1:3847");
        expect(warning).toContain("2.0MB");
        expect(warning).toContain("MONITOR_BASE_URL");
    });

    it("적재량이 작으면 바이트와 킬로바이트로 읽힌다", () => {
        const bytes = formatDeliveryWarning({reachable: false, baseUrl: "u", backlogBytes: 512});
        const kilobytes = formatDeliveryWarning({reachable: false, baseUrl: "u", backlogBytes: 4096});

        expect(bytes).toContain("512B");
        expect(kilobytes).toContain("4KB");
    });
});
