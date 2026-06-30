import { describe, expect, it, vi } from "vitest";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { NOTIFICATION_CHANNEL } from "@monitor/shared/contracts/notifications/redis.notification.publisher.js";
import { RedisFanoutSubscriber, type RedisSubscriberClient } from "./redis.fanout.subscriber.js";
import type { EventBroadcasterService } from "./ws/event.broadcaster.service.js";

function setup() {
    let listener: ((message: string) => void) | undefined;
    const subscriber: RedisSubscriberClient = {
        subscribe: vi.fn(async (channel, cb) => {
            expect(channel).toBe(NOTIFICATION_CHANNEL);
            listener = cb;
        }),
    };
    const fanout = vi.fn();
    const broadcaster = {
        fanout,
    } as unknown as EventBroadcasterService;
    return { subscriber, broadcaster, fanout, emit: (message: string) => listener?.(message) };
}

describe("RedisFanoutSubscriber", () => {
    it("ignores JSON messages that are not notification envelopes", async () => {
        const h = setup();
        await new RedisFanoutSubscriber(h.subscriber, h.broadcaster).start();

        h.emit(JSON.stringify({ userId: "local" }));

        expect(h.fanout).not.toHaveBeenCalled();
    });

    it("fanouts valid notification envelopes", async () => {
        const h = setup();
        await new RedisFanoutSubscriber(h.subscriber, h.broadcaster).start();

        h.emit(JSON.stringify({
            userId: "local",
            notification: { type: NOTIFICATION_TYPE.taskDeleted, payload: { taskId: "t-1" } },
        }));

        expect(h.fanout).toHaveBeenCalledWith(
            "local",
            { type: NOTIFICATION_TYPE.taskDeleted, payload: { taskId: "t-1" } },
        );
    });
});
