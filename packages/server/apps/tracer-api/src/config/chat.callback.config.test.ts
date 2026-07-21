import { describe, expect, it } from "vitest";
import { resolveChatCallbackConfig } from "./chat.callback.config.js";

describe("resolveChatCallbackConfig", () => {
    it("환경변수가 전혀 없으면 기본 포트 8811과 실행 호스트로 주소를 만든다", () => {
        expect(resolveChatCallbackConfig({}, "pod-a")).toEqual({
            port: 8811,
            url: "http://pod-a:8811",
        });
    });

    it("워커의 콜백 포트(8810)와 다른 포트를 쓴다", () => {
        const worker = resolveChatCallbackConfig({ AGENT_CALLBACK_PORT: "8810" }, "pod-a");
        const chat = resolveChatCallbackConfig({}, "pod-a");
        expect(chat.port).not.toBe(8810);
        expect(worker.port).toBe(8811);
    });

    it("CHAT_AGENT_CALLBACK_PORT로 포트를 오버라이드한다", () => {
        expect(resolveChatCallbackConfig({ CHAT_AGENT_CALLBACK_PORT: "9911" }, "pod-a")).toEqual({
            port: 9911,
            url: "http://pod-a:9911",
        });
    });

    it("CHAT_AGENT_CALLBACK_URL이 있으면 그대로 쓴다", () => {
        expect(
            resolveChatCallbackConfig(
                { CHAT_AGENT_CALLBACK_URL: "http://tracer-api:8811", CHAT_AGENT_CALLBACK_PORT: "9911" },
                "pod-a",
            ).url,
        ).toBe("http://tracer-api:8811");
    });

    it("CHAT_AGENT_CALLBACK_HOST가 있으면 실행 호스트 대신 쓴다", () => {
        expect(resolveChatCallbackConfig({ CHAT_AGENT_CALLBACK_HOST: "tracer-api" }, "pod-a").url).toBe(
            "http://tracer-api:8811",
        );
    });
});
