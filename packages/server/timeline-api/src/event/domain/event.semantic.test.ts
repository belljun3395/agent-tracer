import { describe, expect, it } from "vitest";
import { LANE } from "./common/const/event.kind.const.js";
import { resolveSemanticView } from "./event.semantic.js";
import type { TimelineEvent } from "./model/timeline.event.model.js";

function event(overrides: Partial<TimelineEvent>): TimelineEvent {
    return {
        id: "evt-1",
        taskId: "task-1",
        kind: "tool.used",
        lane: LANE.exploration,
        title: "",
        metadata: {},
        classification: { lane: LANE.exploration, tags: [], matches: [] },
        createdAt: "2026-06-01T00:00:00.000Z",
        ...overrides,
    };
}

describe("resolveSemanticView — semantic metadata 해석", () => {
    it("metadata에 subtypeKey가 없으면 title 문자열만으로 subtype을 추론하지 않는다", () => {
        const semantic = resolveSemanticView(event({
            title: "read and grep files",
            lane: LANE.exploration,
            classification: { lane: LANE.exploration, tags: [], matches: [] },
        }));

        expect(semantic).toBeUndefined();
    });

    it("metadata에 subtypeKey가 있으면 semantic view를 만든다", () => {
        const semantic = resolveSemanticView(event({
            title: "apply patch and run test",
            lane: LANE.implementation,
            metadata: {
                subtypeKey: "apply_patch",
                subtypeLabel: "Patch",
                subtypeGroup: "file_ops",
                toolFamily: "file",
            },
            classification: { lane: LANE.implementation, tags: [], matches: [] },
        }));

        expect(semantic?.subtypeKey).toBe("apply_patch");
        expect(semantic?.subtypeLabel).toBe("Patch");
    });
});
