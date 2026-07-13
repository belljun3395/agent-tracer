import { describe, expect, it } from "vitest";
import { AI_JOB_GRAPH_EVENT_KIND, AI_JOB_STEP_ROLE, type AiJobStepList } from "./job.step.const.js";

describe("AiJobStep 계약", () => {
    it("잡 step 읽기 계약은 순서 있는 payload 배열이다", () => {
        const steps = [
            {
                seq: 0,
                attempt: 1,
                role: AI_JOB_STEP_ROLE.user,
                content: "Search recipes",
                truncated: false,
                toolCalls: [],
            },
            {
                seq: 1,
                attempt: 1,
                role: AI_JOB_STEP_ROLE.assistant,
                content: "Calling search_recipes",
                truncated: false,
                toolCalls: [{ id: "tool-1", name: "search_recipes", args: { query: "ramen" } }],
            },
            {
                seq: 2,
                attempt: 2,
                role: AI_JOB_STEP_ROLE.graph,
                content: "증거 충분성 판정을 마쳤다.",
                truncated: false,
                toolCalls: [],
                nodeName: "assess_evidence",
                eventKind: AI_JOB_GRAPH_EVENT_KIND.nodeCompleted,
                durationMs: 14,
            },
        ] satisfies AiJobStepList;

        expect(steps[0]?.seq).toBe(0);
        expect(steps[1]?.toolCalls[0]?.name).toBe("search_recipes");
        expect(steps[2]?.eventKind).toBe("node.completed");
        expect(steps[2]?.attempt).toBe(2);
    });
});
