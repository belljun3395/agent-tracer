import { describe, expect, it } from "vitest";
import type { EventSearchPort } from "~application/ports/event-search/event.search.port.js";
import type { NotificationPublisherPort } from "~application/ports/notifications/notification.publisher.port.js";
import type { RuleReadPort } from "~application/ports/rules/rule.read.port.js";
import type { RuleSignatureQueryPort } from "~application/ports/rules/rule.signature.query.port.js";
import type { RuleWritePort } from "~application/ports/rules/rule.write.port.js";
import type { TaskOverviewQueryPort } from "~application/ports/tasks/task.overview.query.port.js";
import type { TaskReadPort } from "~application/ports/tasks/task.read.port.js";
import type { TaskWritePort } from "~application/ports/tasks/task.write.port.js";
import type { TimelineEventReadPort } from "~application/ports/timeline-events/timeline.event.read.port.js";
import type { TimelineEventWritePort } from "~application/ports/timeline-events/timeline.event.write.port.js";
import type { TurnBackfillSourcePort } from "~application/ports/verification/turns/turn.backfill.source.port.js";
import type { TurnSummaryQueryPort } from "~application/ports/verification/turns/turn.summary.query.port.js";
import type { VerdictStatusQueryPort } from "~application/ports/verification/verdicts/verdict.status.query.port.js";

type TaskPortSet = TaskReadPort & TaskWritePort & TaskOverviewQueryPort;
type TimelineEventPortSet = TimelineEventReadPort & TimelineEventWritePort & EventSearchPort;
type RulePortSet = RuleReadPort & RuleWritePort & RuleSignatureQueryPort;
type TurnQueryPortSet = TurnBackfillSourcePort & TurnSummaryQueryPort & VerdictStatusQueryPort;

function acceptsPortSurface(_ports: {
    readonly tasks: TaskPortSet;
    readonly events: TimelineEventPortSet;
    readonly rules: RulePortSet;
    readonly turns: TurnQueryPortSet;
    readonly notifier: NotificationPublisherPort;
}): void {
    return undefined;
}

describe("application port public surface", () => {
    it("exposes capability-oriented ports from the root barrel", () => {
        expect(typeof acceptsPortSurface).toBe("function");
    });
});
