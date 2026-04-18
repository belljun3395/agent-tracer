import { describe, expect, it } from "vitest";
import { buildLaneSections, buildPlanSection, EventId, TaskId, type TimelineEvent } from "@monitor/domain";

type EventOverrides = Omit<Partial<TimelineEvent>, "id" | "taskId"> & {
    id?: string;
    taskId?: string;
};

function makeEvent(overrides: EventOverrides = {}): TimelineEvent {
    const { id, taskId, ...rest } = overrides;
    return {
        id: EventId(id ?? "event-1"),
        taskId: TaskId(taskId ?? "task-1"),
        kind: rest.kind ?? "context.saved",
        lane: rest.lane ?? "planning",
        title: rest.title ?? "Context saved",
        metadata: rest.metadata ?? {},
        classification: rest.classification ?? {
            lane: rest.lane ?? "planning",
            tags: [],
            matches: []
        },
        createdAt: rest.createdAt ?? "2026-03-28T00:00:00.000Z",
        ...rest
    };
}
describe("workflow context builder", () => {
    it("plan section prefers body/detail over generic titles", () => {
        const section = buildPlanSection([
            makeEvent({
                body: "Inspect README wording and update workflow search ranking."
            })
        ]);
        expect(section).toContain("Inspect README wording and update workflow search ranking.");
        expect(section).not.toContain("- Context saved");
    });
    it("lane sections include metadata descriptions and terminal commands", () => {
        const sections = buildLaneSections([
            makeEvent({
                id: "event-implementation",
                kind: "terminal.command",
                lane: "implementation",
                title: "Terminal command",
                metadata: {
                    command: "npm test --workspace @monitor/server",
                    description: "Run targeted server regression tests"
                },
                classification: {
                    lane: "implementation",
                    tags: [],
                    matches: []
                }
            })
        ]);
        expect(sections[0]).toContain("Run targeted server regression tests");
        expect(sections[0]).not.toContain("- Terminal command");
    });
});
