import { describe, expect, it, vi } from "vitest";
import type { KafkaProducer } from "@monitor/platform";
import * as platform from "@monitor/platform";
import type { NotificationEnvelope } from "@monitor/kernel";
import { KafkaNotificationPublisher } from "./kafka.notification.publisher.js";

function envelope(userId: string): NotificationEnvelope {
    return { userId, payload: { kind: "job.completed" } } as unknown as NotificationEnvelope;
}

describe("KafkaNotificationPublisher", () => {
    it("봉투를 알림 토픽 producer로 넘긴다", async () => {
        const publish = vi.spyOn(platform, "publishNotification").mockResolvedValue(undefined);
        const producer = {} as unknown as KafkaProducer;

        await new KafkaNotificationPublisher(producer).publish(envelope("u1"));

        expect(publish).toHaveBeenCalledWith(producer, envelope("u1"));
        publish.mockRestore();
    });
});
