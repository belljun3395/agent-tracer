import { describe, expect, it, vi } from "vitest";
import { createKafkaReadinessProbe } from "./readiness.probe.js";

describe("createKafkaReadinessProbe", () => {
    it("admin 재시도 없이 topic 목록으로 broker 연결을 점검한다", async () => {
        const admin = {
            connect: vi.fn(async () => undefined),
            listTopics: vi.fn(async () => []),
            disconnect: vi.fn(async () => undefined),
        };
        const kafka = { admin: vi.fn(() => admin) };

        await createKafkaReadinessProbe(kafka).ping();

        expect(kafka.admin).toHaveBeenCalledWith({kafkaJS: {retry: {retries: 0}}});
        expect(admin.connect).toHaveBeenCalledOnce();
        expect(admin.listTopics).toHaveBeenCalledOnce();
        expect(admin.disconnect).toHaveBeenCalledOnce();
    });

    it("topic 목록 조회가 실패해도 연결 해제를 시도한다", async () => {
        const admin = {
            connect: vi.fn(async () => undefined),
            listTopics: vi.fn(async () => {
                throw new Error("broker unavailable");
            }),
            disconnect: vi.fn(async () => undefined),
        };
        const kafka = { admin: vi.fn(() => admin) };

        await expect(createKafkaReadinessProbe(kafka).ping()).rejects.toThrow("broker unavailable");

        expect(admin.disconnect).toHaveBeenCalledOnce();
    });
});
