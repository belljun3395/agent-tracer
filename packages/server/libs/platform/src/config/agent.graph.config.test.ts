import { describe, expect, it } from "vitest";
import { resolveToolCallbackInstanceId, resolveToolCallbackUrl } from "./agent.graph.config.js";

describe("resolveToolCallbackUrl", () => {
    it("명시적 환경변수 주소가 있으면 그대로 쓴다", () => {
        expect(resolveToolCallbackUrl("http://temporal-worker:8810", undefined, "pod-a", 8810))
            .toBe("http://temporal-worker:8810");
    });

    it("환경변수 주소가 없고 YAML 값이 있으면 YAML 값을 쓴다", () => {
        expect(resolveToolCallbackUrl(undefined, "http://from-yaml:8810", "pod-a", 8810))
            .toBe("http://from-yaml:8810");
    });

    it("설정 주소가 전혀 없으면 실행 호스트 주소를 만든다", () => {
        expect(resolveToolCallbackUrl(undefined, undefined, "pod-a", 8810))
            .toBe("http://pod-a:8810");
    });
});

describe("resolveToolCallbackInstanceId", () => {
    it("명시적 복제본 식별자가 있으면 그대로 쓴다", () => {
        expect(resolveToolCallbackInstanceId("worker-replica-1", "pod-a")).toBe("worker-replica-1");
    });

    it("명시적 복제본 식별자가 없으면 실행 호스트를 쓴다", () => {
        expect(resolveToolCallbackInstanceId(undefined, "pod-a")).toBe("pod-a");
    });

    it("공백뿐인 복제본 식별자는 무시하고 실행 호스트를 쓴다", () => {
        expect(resolveToolCallbackInstanceId("   ", "pod-a")).toBe("pod-a");
    });
});
