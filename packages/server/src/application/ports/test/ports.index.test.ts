import { describe, expect, it } from "vitest";
import type { EventSearchPort } from "~application/ports/event-search/event.search.port.js";
import type { NotificationPublisherPort } from "~application/ports/notifications/notification.publisher.port.js";
import type { TimelineEventReadPort } from "~application/ports/timeline-events/timeline.event.read.port.js";
import type { TimelineEventWritePort } from "~application/ports/timeline-events/timeline.event.write.port.js";
import type { ITurnQueryRepository } from "~application/ports/repository/turn.query.repository.js";

type TimelineEventPortSet = TimelineEventReadPort & TimelineEventWritePort & EventSearchPort;

function acceptsPortSurface(_ports: {
    readonly events: TimelineEventPortSet;
    readonly turns: ITurnQueryRepository;
    readonly notifier: NotificationPublisherPort;
}): void {
    return undefined;
}

describe("application port public surface", () => {
    it("exposes capability-oriented ports from the root barrel", () => {
        expect(typeof acceptsPortSurface).toBe("function");
    });
});
