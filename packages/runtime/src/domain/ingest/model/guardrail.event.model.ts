import {
    KIND,
    LANE,
    provenEvidence,
    turnOf,
    type IngestTarget,
    type RuntimeIngestEvent,
} from "~runtime/domain/ingest/model/event.model.js";
import type {RuleLoggedMetadata} from "~runtime/domain/ingest/model/session.metadata.model.js";

/** 턴을 붙잡은 규칙 하나와 그때 손에 쥐고 있던 증거의 크기다. */
export interface TurnBlockedInput {
    readonly ruleId: string;
    readonly ruleName: string;
    readonly severity: string;
    readonly expectedPattern?: string;
    readonly actualToolCallCount: number;
}

export function turnBlockedEvent(target: IngestTarget, input: TurnBlockedInput): RuntimeIngestEvent {
    const expected = input.expectedPattern !== undefined
        ? `Expected: ${input.expectedPattern}. `
        : "";
    const metadata: RuleLoggedMetadata = {
        ...provenEvidence("Emitted by the Stop hook when the guardrail halted the turn."),
        ruleStatus: "unfulfilled",
        ruleOutcome: "turn_blocked",
        rulePolicy: "guardrail",
        ruleId: input.ruleId,
        ruleSeverity: input.severity,
        ...(input.expectedPattern !== undefined ? {expectedPattern: input.expectedPattern} : {}),
        actualToolCallCount: input.actualToolCallCount,
    };
    return {
        kind: KIND.ruleLogged,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.rule,
        title: `Turn blocked: ${input.ruleName}`,
        body: `${expected}No matching call among the ${input.actualToolCallCount} recorded since the request.`,
        metadata,
    };
}
