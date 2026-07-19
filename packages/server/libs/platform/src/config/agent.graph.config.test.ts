import { describe, expect, it } from "vitest";
import { resolveCallbackUrl } from "./agent.graph.config.js";

describe("resolveCallbackUrl", () => {
    it("명시적 환경변수 주소가 있으면 그대로 쓴다", () => {
        expect(resolveCallbackUrl("http://ai-agent-worker:8810", undefined, "pod-a", 8810)).toBe(
            "http://ai-agent-worker:8810",
        );
    });

    it("환경변수 주소가 없고 YAML 값이 있으면 YAML 값을 쓴다", () => {
        expect(resolveCallbackUrl(undefined, "http://from-yaml:8810", "pod-a", 8810)).toBe(
            "http://from-yaml:8810",
        );
    });

    it("설정 주소가 전혀 없으면 실행 호스트 주소를 만든다", () => {
        expect(resolveCallbackUrl(undefined, undefined, "pod-a", 8810)).toBe("http://pod-a:8810");
    });
});
