import { describe, expect, it } from "vitest";
import { EventId, TaskId } from "../../types.js";
import { buildDisplayLaneRows, countLaneSubtypes, resolveEventSubtype, resolveTimelineRowKey, type TimelineEventRecord } from "../../types.js";
type EventOverrides = Omit<Partial<TimelineEventRecord>, "id" | "taskId"> & {
    id?: string;
    taskId?: string;
};
function makeEvent(overrides: EventOverrides = {}): TimelineEventRecord {
    const { id, taskId, ...rest } = overrides;
    return {
        id: EventId(id ?? "event-1"),
        taskId: TaskId(taskId ?? "task-1"),
        kind: rest.kind ?? "tool.used",
        lane: rest.lane ?? "implementation",
        title: rest.title ?? "Event",
        metadata: rest.metadata ?? {},
        classification: rest.classification ?? {
            lane: rest.lane ?? "implementation",
            tags: [],
            matches: []
        },
        createdAt: rest.createdAt ?? "2026-03-16T09:00:00.000Z",
        ...rest
    };
}
describe("resolveEventSubtype", () => {
    it("reads subtype from the server-owned semantic contract", () => {
        const subtype = resolveEventSubtype({
            ...makeEvent({
                lane: "implementation",
                metadata: {
                    subtypeKey: "run_lint",
                    subtypeLabel: "metadata should be ignored",
                }
            }),
            semantic: {
                subtypeKey: "run_test",
                subtypeLabel: "Run test",
                subtypeGroup: "execution",
                entityType: "command",
                entityName: "pnpm"
            }
        } as TimelineEventRecord & {
            semantic: {
                subtypeKey: "run_test";
                subtypeLabel: "Run test";
                subtypeGroup: "execution";
                entityType: "command";
                entityName: "pnpm";
            };
        });

        expect(subtype).toEqual({
            key: "run_test",
            label: "Run test",
            icon: "🧪",
            group: "execution",
            entityType: "command",
            entityName: "pnpm"
        });
    });

    it("returns null when the server did not derive semantic subtype data", () => {
        const subtype = resolveEventSubtype(makeEvent({
            lane: "implementation",
            metadata: {
                subtypeKey: "run_test",
                subtypeLabel: "Run test",
                entityType: "command",
                entityName: "npm"
            },
        }));

        expect(subtype).toBeNull();
    });
});
describe("buildDisplayLaneRows", () => {
    it("expands implementation into subtype rows when requested", () => {
        const events = [
            makeEvent({
                id: "test",
                lane: "implementation",
                semantic: { subtypeKey: "run_test", subtypeLabel: "Run test" }
            }),
            makeEvent({
                id: "lint",
                lane: "implementation",
                semantic: { subtypeKey: "run_lint", subtypeLabel: "Run lint" }
            })
        ];
        const rows = buildDisplayLaneRows(events, ["implementation"], new Set(["implementation"]));
        expect(rows).toEqual([
            { key: "implementation:run_test", baseLane: "implementation", isSubtype: true, subtypeKey: "run_test", subtypeLabel: "Run test" },
            { key: "implementation:run_lint", baseLane: "implementation", isSubtype: true, subtypeKey: "run_lint", subtypeLabel: "Run lint" }
        ]);
    });
    it("routes subtype events into the matching expanded row key", () => {
        const event = makeEvent({
            lane: "coordination",
            semantic: { subtypeKey: "mcp_call", subtypeLabel: "MCP call" }
        });
        expect(resolveTimelineRowKey(event, new Set(["coordination"]))).toBe("coordination:mcp_call");
        expect(countLaneSubtypes([event], "coordination")).toBe(1);
    });
});
