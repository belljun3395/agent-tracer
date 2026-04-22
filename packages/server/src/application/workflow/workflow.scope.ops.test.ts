import { describe, expect, it } from "vitest";
import type { TimelineEvent } from "~domain/monitoring/timeline.event.js";
import {
    filterWorkflowEventsByScope,
    normalizeWorkflowScopeKey,
    resolveWorkflowScope,
} from "./workflow.scope.ops.js";

function makeEvent(id: string, kind: TimelineEvent["kind"], createdAt: string): TimelineEvent {
    return {
        id,
        taskId: "t-1",
        kind,
        lane: "user",
        title: "e",
        body: "",
        metadata: {},
        classification: { lane: "user", tags: [], matches: [] },
        createdAt,
    };
}

function sampleEvents(): readonly TimelineEvent[] {
    return [
        makeEvent("u1", "user.message", "2026-04-22T10:00:00.000Z"),
        makeEvent("t1", "tool.used", "2026-04-22T10:00:01.000Z"),
        makeEvent("u2", "user.message", "2026-04-22T10:00:10.000Z"),
        makeEvent("t2", "tool.used", "2026-04-22T10:00:11.000Z"),
        makeEvent("u3", "user.message", "2026-04-22T10:00:20.000Z"),
        makeEvent("t3", "tool.used", "2026-04-22T10:00:21.000Z"),
    ];
}

describe("normalizeWorkflowScopeKey", () => {
    it("collapses single-turn range into turn:N", () => {
        expect(normalizeWorkflowScopeKey("turns:2-2")).toBe("turn:2");
    });

    it("preserves well-formed multi-turn range", () => {
        expect(normalizeWorkflowScopeKey("turns:2-4")).toBe("turns:2-4");
    });

    it("rejects inverted range", () => {
        expect(normalizeWorkflowScopeKey("turns:5-2")).toBe("task");
    });

    it("rejects zero index", () => {
        expect(normalizeWorkflowScopeKey("turns:0-2")).toBe("task");
    });

    it("keeps existing scopes working", () => {
        expect(normalizeWorkflowScopeKey("task")).toBe("task");
        expect(normalizeWorkflowScopeKey("last-turn")).toBe("last-turn");
        expect(normalizeWorkflowScopeKey("turn:3")).toBe("turn:3");
    });
});

describe("resolveWorkflowScope", () => {
    it("labels a range", () => {
        const scope = resolveWorkflowScope("turns:2-3", sampleEvents());
        expect(scope).toMatchObject({
            scopeKey: "turns:2-3",
            scopeKind: "turn",
            scopeLabel: "Turns 2–3",
            turnIndex: null,
        });
    });
});

describe("filterWorkflowEventsByScope", () => {
    it("filters by range", () => {
        const filtered = filterWorkflowEventsByScope(sampleEvents(), "turns:2-3");
        expect(filtered.map((e) => e.id)).toEqual(["u2", "t2", "u3", "t3"]);
    });

    it("still filters by single turn", () => {
        const filtered = filterWorkflowEventsByScope(sampleEvents(), "turn:2");
        expect(filtered.map((e) => e.id)).toEqual(["u2", "t2"]);
    });
});
