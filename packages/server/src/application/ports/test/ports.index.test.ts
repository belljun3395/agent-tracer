import { describe, expect, it } from "vitest";
import type {
    EventSearchPort,
    NotificationPublisherPort,
    RuleReadPort,
    RuleSignatureQueryPort,
    RuleWritePort,
    TaskOverviewQueryPort,
    TaskReadPort,
    TaskWritePort,
    TimelineEventReadPort,
    TimelineEventWritePort,
    TurnBackfillSourcePort,
    TurnSummaryQueryPort,
    VerdictStatusQueryPort,
} from "~application/ports/index.js";

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
