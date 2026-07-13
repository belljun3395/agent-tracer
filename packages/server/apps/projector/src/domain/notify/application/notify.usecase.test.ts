import { describe, expect, it } from "vitest";
import type { NotificationEnvelope } from "@monitor/kernel";
import type { NotificationPublisherPort } from "~projector/domain/notify/port/notification.publisher.port.js";
import { NotifyUseCase } from "~projector/domain/notify/application/notify.usecase.js";

function envelope(userId: string): NotificationEnvelope {
    return { userId, payload: { kind: "job.completed" } } as unknown as NotificationEnvelope;
}

class RecordingPublisher implements NotificationPublisherPort {
    readonly published: NotificationEnvelope[] = [];

    publish(envelope: NotificationEnvelope): Promise<void> {
        this.published.push(envelope);
        return Promise.resolve();
    }
}

describe("NotifyUseCase", () => {
    it("봉투를 받은 순서대로 하나씩 발행한다", async () => {
        const publisher = new RecordingPublisher();

        await new NotifyUseCase(publisher).execute([envelope("u1"), envelope("u2")]);

        expect(publisher.published).toEqual([envelope("u1"), envelope("u2")]);
    });

    it("발행할 봉투가 없으면 아무것도 하지 않는다", async () => {
        const publisher = new RecordingPublisher();

        await new NotifyUseCase(publisher).execute([]);

        expect(publisher.published).toHaveLength(0);
    });
});
