import { describe, expect, it } from "vitest";
import { EventId, TaskId } from "@monitor/core";
import { FULL_TIMELINE_LANE_FILTERS, buildFilteredTimeline, buildSelectedConnector, buildTaskWorkspaceSelection, parseConnectorKey, type TimelineEvent } from "@monitor/web-domain";

type EventOverrides = Omit<Partial<TimelineEvent>, "id" | "taskId"> & {
    id?: TimelineEvent["id"] | string;
    taskId?: TimelineEvent["taskId"] | string;
};

function makeEvent(overrides: EventOverrides = {}): TimelineEvent {
    const { id, taskId, ...rest } = overrides;
    const nextEventId = id === undefined ? EventId("event-1") : typeof id === "string" ? EventId(id) : id;
    const nextTaskId = taskId === undefined ? TaskId("task-1") : typeof taskId === "string" ? TaskId(taskId) : taskId;
    return {
        id: nextEventId,
        taskId: nextTaskId,
        kind: rest.kind ?? "tool.used",
        lane: rest.lane ?? "implementation",
        title: rest.title ?? "event",
        metadata: rest.metadata ?? {},
        classification: rest.classification ?? {
            lane: rest.lane ?? "implementation",
            tags: [],
            matches: []
        },
        createdAt: rest.createdAt ?? "2026-03-16T12:00:00.000Z",
        ...rest
    };
}

describe("taskWorkspace helpers", () => {
    it("parses connector keys with optional relation type", () => {
        expect(parseConnectorKey("source→target:sequence")).toEqual({
            sourceEventId: "source",
            targetEventId: "target",
            relationType: "sequence"
        });
        expect(parseConnectorKey("source→target")).toEqual({
            sourceEventId: "source",
            targetEventId: "target"
        });
        expect(parseConnectorKey("broken")).toBeNull();
    });

    it("builds selected connector data from timeline events", () => {
        const timeline = [
            makeEvent({ id: "source", lane: "planning" }),
            makeEvent({ id: "target", lane: "implementation" })
        ];
        const selection = buildSelectedConnector(timeline, "source→target");
        expect(selection?.source.id).toBe(EventId("source"));
        expect(selection?.target.id).toBe(EventId("target"));
        expect(selection?.connector.cross).toBe(true);
        expect(selection?.connector.targetLane).toBe("implementation");
    });

    it("uses shared full-lane filters for workspace timeline selection", () => {
        const filtered = buildFilteredTimeline({
            timeline: [
            makeEvent({
                id: EventId("rule"),
                lane: "implementation",
                metadata: { ruleId: "policy-1" },
                classification: {
                    lane: "implementation",
                    tags: ["backend"],
                    matches: []
                }
            }),
            makeEvent({
                id: EventId("other"),
                lane: "planning",
                classification: {
                    lane: "planning",
                    tags: ["frontend"],
                    matches: []
                }
            })
        ],
            selectedRuleId: "policy-1",
            selectedTag: "backend",
            showRuleGapsOnly: false
        });
        expect(FULL_TIMELINE_LANE_FILTERS.implementation).toBe(true);
        expect(filtered.map((event) => event.id)).toEqual([EventId("rule")]);
    });

    it("returns connector-aware workspace selection and suppresses selected event when a connector is active", () => {
        const timeline = [
            makeEvent({
                id: "source",
                lane: "user",
                title: "Start"
            }),
            makeEvent({
                id: "target",
                lane: "implementation",
                title: "Finish"
            })
        ];
        const selection = buildTaskWorkspaceSelection({
            timeline,
            selectedConnectorKey: "source→target",
            selectedEventId: "target",
            selectedRuleId: null,
            selectedTag: null,
            showRuleGapsOnly: false,
            taskDisplayTitle: "Task title"
        });
        expect(selection.selectedConnector?.target.id).toBe(EventId("target"));
        expect(selection.selectedEvent).toBeNull();
        expect(selection.selectedEventDisplayTitle).toBeNull();
    });
});
