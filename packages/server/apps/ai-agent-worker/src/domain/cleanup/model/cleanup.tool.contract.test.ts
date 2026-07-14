import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanupSuggestionsListSchema } from "@monitor/kernel/agent/task.cleanup.schema.js";
import { TASK_CLEANUP_MAX_TURNS } from "./cleanup.prompt.js";
import {
    DEFAULT_CANDIDATE_LIMIT,
    DEFAULT_EVENT_LIMIT,
    DEFAULT_EVENT_ORDER,
    parseGetTaskEventsArgs,
    parseListCandidateTasksArgs,
    TASK_CLEANUP_TOOL,
    TASK_CLEANUP_TOOLS,
} from "./cleanup.tool.schema.js";

// 두 언어가 같은 파일을 읽어야 한쪽만 바뀌는 드리프트가 남지 않는다.
const CONTRACT = JSON.parse(
    readFileSync(
        new URL("../../../../../../../kernel/src/agent/__fixtures__/task.cleanup.tool.contract.json", import.meta.url),
        "utf8",
    ),
) as {
    readonly maxTurns: number;
    readonly outputKinds: string[];
    readonly tools: Record<
        string,
        {
            readonly required: string[];
            readonly optional: string[];
            readonly limit: { readonly default: number; readonly min: number; readonly max: number };
            readonly order?: { readonly default: string; readonly values: string[] };
        }
    >;
};

function partitionFields(toolName: string): { readonly required: string[]; readonly optional: string[] } {
    const spec = TASK_CLEANUP_TOOLS.find((tool) => tool.name === toolName);
    const required: string[] = [];
    const optional: string[] = [];
    for (const [field, schema] of Object.entries(spec!.shape)) {
        (schema.safeParse(undefined).success ? optional : required).push(field);
    }
    return { required, optional };
}

const CANDIDATES = CONTRACT.tools[TASK_CLEANUP_TOOL.listCandidateTasks]!;
const EVENTS = CONTRACT.tools[TASK_CLEANUP_TOOL.getTaskEvents]!;

describe("task-cleanup 도구 계약", () => {
    it("턴 예산이 골든 계약과 같다", () => {
        expect(TASK_CLEANUP_MAX_TURNS).toBe(CONTRACT.maxTurns);
    });

    it("모델에게 여는 도구 이름이 골든 계약과 같다", () => {
        expect(new Set(TASK_CLEANUP_TOOLS.map((tool) => tool.name))).toEqual(new Set(Object.keys(CONTRACT.tools)));
    });

    it("list_candidate_tasks의 필수와 선택 인자가 골든 계약과 같다", () => {
        const { required, optional } = partitionFields(TASK_CLEANUP_TOOL.listCandidateTasks);

        expect(new Set(required)).toEqual(new Set(CANDIDATES.required));
        expect(new Set(optional)).toEqual(new Set(CANDIDATES.optional));
    });

    it("get_task_events의 필수와 선택 인자가 골든 계약과 같다", () => {
        const { required, optional } = partitionFields(TASK_CLEANUP_TOOL.getTaskEvents);

        expect(new Set(required)).toEqual(new Set(EVENTS.required));
        expect(new Set(optional)).toEqual(new Set(EVENTS.optional));
    });

    it("list_candidate_tasks의 limit 기본값과 상하한이 골든 계약과 같다", () => {
        expect(DEFAULT_CANDIDATE_LIMIT).toBe(CANDIDATES.limit.default);
        expect(parseListCandidateTasksArgs({}).limit).toBeUndefined();
        expect(parseListCandidateTasksArgs({ limit: CANDIDATES.limit.max }).limit).toBe(CANDIDATES.limit.max);
        expect(parseListCandidateTasksArgs({ limit: CANDIDATES.limit.min }).limit).toBe(CANDIDATES.limit.min);
        expect(() => parseListCandidateTasksArgs({ limit: CANDIDATES.limit.max + 1 })).toThrow();
        expect(() => parseListCandidateTasksArgs({ limit: CANDIDATES.limit.min - 1 })).toThrow();
    });

    it("get_task_events의 limit 기본값과 상하한이 골든 계약과 같다", () => {
        expect(DEFAULT_EVENT_LIMIT).toBe(EVENTS.limit.default);
        expect(parseGetTaskEventsArgs({ taskId: "task-1" }).limit).toBeUndefined();
        expect(parseGetTaskEventsArgs({ taskId: "task-1", limit: EVENTS.limit.max }).limit).toBe(EVENTS.limit.max);
        expect(parseGetTaskEventsArgs({ taskId: "task-1", limit: EVENTS.limit.min }).limit).toBe(EVENTS.limit.min);
        expect(() => parseGetTaskEventsArgs({ taskId: "task-1", limit: EVENTS.limit.max + 1 })).toThrow();
        expect(() => parseGetTaskEventsArgs({ taskId: "task-1", limit: EVENTS.limit.min - 1 })).toThrow();
    });

    it("get_task_events의 읽기 방향 기본값과 허용값이 골든 계약과 같다", () => {
        expect(DEFAULT_EVENT_ORDER).toBe(EVENTS.order!.default);
        expect(parseGetTaskEventsArgs({ taskId: "task-1" }).order).toBeUndefined();
        for (const value of EVENTS.order!.values) {
            expect(parseGetTaskEventsArgs({ taskId: "task-1", order: value }).order).toBe(value);
        }
        expect(() => parseGetTaskEventsArgs({ taskId: "task-1", order: "sideways" })).toThrow();
    });

    it("제안 종류가 골든 계약과 같다", () => {
        for (const kind of CONTRACT.outputKinds) {
            const parsed = cleanupSuggestionsListSchema.safeParse({
                suggestions: [{ kind, taskId: "task-1", rationale: "이벤트가 하나도 없다" }],
            });
            expect(parsed.success).toBe(true);
        }
        const foreign = cleanupSuggestionsListSchema.safeParse({
            suggestions: [{ kind: "merge", taskId: "task-1", rationale: "이벤트가 하나도 없다" }],
        });
        expect(foreign.success).toBe(false);
    });
});
