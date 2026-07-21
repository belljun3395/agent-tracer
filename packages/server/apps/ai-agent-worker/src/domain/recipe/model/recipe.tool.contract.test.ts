import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { RECIPE_CANDIDATE_LIMIT, TIMELINE_EVENT_KINDS } from "@monitor/kernel";
import { RECIPE_SCAN_MAX_TURNS } from "./recipe.prompt.js";
import { RECIPE_SCAN_SPEC } from "./recipe.spec.js";
import {
    RECIPE_COORDINATOR_TOOLS,
    RECIPE_WORKER_MAX_TURNS,
    RECIPE_WORKER_TOOLS,
} from "../adapter/recipe.sdk.agent.adapter.js";
import {
    DEFAULT_EVENT_LIMIT,
    DEFAULT_SEARCH_LIMIT,
    DEFAULT_SIMILAR_TASK_LIMIT,
    EVENT_ORDER,
    parseFindSimilarTasksArgs,
    parseGetTaskEventsArgs,
    parseGetTaskSummaryArgs,
    parseListRulesArgs,
    parseSearchEventsArgs,
    parseSearchRecipesArgs,
    RECIPE_SCAN_TOOL,
    RECIPE_SCAN_TOOLS,
    SUMMARY_EVENT_WINDOW,
} from "./recipe.tool.schema.js";

interface NumberContract {
    readonly default: number;
    readonly min: number;
    readonly max: number;
}

interface ToolContract {
    readonly required: string[];
    readonly optional: string[];
    readonly numbers?: Readonly<Record<string, NumberContract>>;
    readonly enums?: Readonly<Record<string, { readonly default?: string; readonly values: string[] }>>;
}

// 두 언어가 같은 파일을 읽어야 한쪽만 바뀌는 드리프트가 남지 않는다.
const CONTRACT = JSON.parse(
    readFileSync(
        new URL("../../../../../../../kernel/src/agent/__fixtures__/recipe.scan.tool.contract.json", import.meta.url),
        "utf8",
    ),
) as {
    readonly descriptions: Record<string, string>;
    readonly maxTurns: number;
    readonly limits: {
        readonly candidateLimit: number;
        readonly maxOutputTokens: number;
        readonly maxBudgetUsd: number;
    };
    readonly steps: { readonly consecutiveFromOne: boolean };
    readonly orchestration: {
        readonly workerMaxTurns: number;
        readonly coordinatorTools: readonly string[];
        readonly roles: Readonly<Record<string, readonly string[]>>;
        readonly workerReport: { readonly required: readonly string[]; readonly excerptRequired: readonly string[] };
    };
    readonly tools: Readonly<Record<string, ToolContract>>;
};

type Parse = (raw: unknown) => unknown;

const PARSERS: Readonly<Record<string, Parse>> = {
    [RECIPE_SCAN_TOOL.getTaskSummary]: parseGetTaskSummaryArgs,
    [RECIPE_SCAN_TOOL.getTaskEvents]: parseGetTaskEventsArgs,
    [RECIPE_SCAN_TOOL.listRules]: parseListRulesArgs,
    [RECIPE_SCAN_TOOL.searchEvents]: parseSearchEventsArgs,
    [RECIPE_SCAN_TOOL.findSimilarTasks]: parseFindSimilarTasksArgs,
    [RECIPE_SCAN_TOOL.searchRecipes]: parseSearchRecipesArgs,
};

const VALID_ARGS: Readonly<Record<string, Record<string, unknown>>> = {
    [RECIPE_SCAN_TOOL.getTaskSummary]: { taskId: "task-1" },
    [RECIPE_SCAN_TOOL.getTaskEvents]: { taskId: "task-1" },
    [RECIPE_SCAN_TOOL.listRules]: { taskId: "task-1" },
    [RECIPE_SCAN_TOOL.searchEvents]: { q: "migration" },
    [RECIPE_SCAN_TOOL.findSimilarTasks]: { anchorTaskId: "task-1" },
    [RECIPE_SCAN_TOOL.searchRecipes]: { q: "migration" },
};

// 도구 인자를 생략했을 때 워커가 채우는 값이며 스키마 상수가 곧 그 기본값이다.
const DEFAULTS: Readonly<Record<string, Record<string, number | string>>> = {
    [RECIPE_SCAN_TOOL.getTaskSummary]: { window: SUMMARY_EVENT_WINDOW },
    [RECIPE_SCAN_TOOL.getTaskEvents]: { limit: DEFAULT_EVENT_LIMIT, order: EVENT_ORDER.asc },
    [RECIPE_SCAN_TOOL.listRules]: {},
    [RECIPE_SCAN_TOOL.searchEvents]: { limit: DEFAULT_SEARCH_LIMIT, offset: 0 },
    [RECIPE_SCAN_TOOL.findSimilarTasks]: { limit: DEFAULT_SIMILAR_TASK_LIMIT },
    [RECIPE_SCAN_TOOL.searchRecipes]: { limit: DEFAULT_SIMILAR_TASK_LIMIT },
};

function partitionFields(tool: string): { readonly required: string[]; readonly optional: string[] } {
    const spec = RECIPE_SCAN_TOOLS.find((candidate) => candidate.name === tool);
    const shape = z.object(spec!.shape).shape;
    const required: string[] = [];
    const optional: string[] = [];
    for (const [field, schema] of Object.entries(shape)) {
        (schema.safeParse(undefined).success ? optional : required).push(field);
    }
    return { required, optional };
}

function accepts(tool: string, field: string, value: unknown): boolean {
    const parse = PARSERS[tool];
    try {
        parse!({ ...VALID_ARGS[tool], [field]: value });
        return true;
    } catch {
        return false;
    }
}

function candidateWithStepOrders(orders: readonly number[]): unknown {
    return {
        recipes: [
            {
                title: "Add a migration",
                intent: "migration",
                description: "d",
                summary_md: "s",
                request: "r",
                rationale: "why",
                steps: orders.map((order) => ({ order, action: `step-${order}` })),
                contributing_slices: [{ taskId: "task-1", turnIds: [], eventIds: ["event-1"] }],
            },
        ],
    };
}

describe("recipe-scan 도구 계약", () => {
    it("턴 예산이 골든 계약과 같다", () => {
        expect(RECIPE_SCAN_MAX_TURNS).toBe(CONTRACT.maxTurns);
    });

    it("후보 상한과 토큰과 비용 예산이 골든 계약과 같다", () => {
        expect(RECIPE_CANDIDATE_LIMIT).toBe(CONTRACT.limits.candidateLimit);
        expect(RECIPE_SCAN_SPEC.limits.maxOutputTokens).toBe(CONTRACT.limits.maxOutputTokens);
        expect(RECIPE_SCAN_SPEC.limits.maxBudgetUsd).toBe(CONTRACT.limits.maxBudgetUsd);
    });

    it("모델에게 노출하는 도구 이름이 골든 계약과 같다", () => {
        expect(RECIPE_SCAN_TOOLS.map((tool) => tool.name)).toEqual(Object.keys(CONTRACT.tools));
    });

    it("SDK 워커 역할과 도구와 턴 몫이 골든 계약과 같다", () => {
        expect(RECIPE_WORKER_MAX_TURNS).toBe(CONTRACT.orchestration.workerMaxTurns);
        expect(RECIPE_WORKER_TOOLS).toEqual(CONTRACT.orchestration.roles);
    });

    it("조율자 리드가 쥔 도구가 골든 계약과 같다", () => {
        // 조율자는 근거를 직접 캐지 않고 인용만 확인하므로 리드에 남는 조사 도구는 check_citations 하나다.
        expect([...RECIPE_COORDINATOR_TOOLS]).toEqual(CONTRACT.orchestration.coordinatorTools);
    });

    it("도구마다 필수와 선택 인자가 골든 계약과 같다", () => {
        for (const [tool, contract] of Object.entries(CONTRACT.tools)) {
            const { required, optional } = partitionFields(tool);

            expect(new Set(required)).toEqual(new Set(contract.required));
            expect(new Set(optional)).toEqual(new Set(contract.optional));
        }
    });

    it("도구마다 수치 인자의 기본값과 상하한이 골든 계약과 같다", () => {
        for (const [tool, contract] of Object.entries(CONTRACT.tools)) {
            for (const [field, bound] of Object.entries(contract.numbers ?? {})) {
                expect(DEFAULTS[tool]?.[field]).toBe(bound.default);
                expect(accepts(tool, field, bound.min)).toBe(true);
                expect(accepts(tool, field, bound.max)).toBe(true);
                expect(accepts(tool, field, bound.min - 1)).toBe(false);
                expect(accepts(tool, field, bound.max + 1)).toBe(false);
            }
        }
    });

    it("도구마다 열거 인자의 값과 기본값이 골든 계약과 같다", () => {
        for (const [tool, contract] of Object.entries(CONTRACT.tools)) {
            for (const [field, enumeration] of Object.entries(contract.enums ?? {})) {
                for (const value of enumeration.values) {
                    expect(accepts(tool, field, value)).toBe(true);
                }
                expect(accepts(tool, field, "drifted.value")).toBe(false);
                if (enumeration.default !== undefined) {
                    expect(DEFAULTS[tool]?.[field]).toBe(enumeration.default);
                }
            }
        }
    });

    it("search_events가 거르는 이벤트 종류가 골든 계약과 같다", () => {
        expect([...TIMELINE_EVENT_KINDS]).toEqual(CONTRACT.tools["search_events"]?.enums?.["kind"]?.values);
    });

    it("steps의 order가 1부터 연속하지 않은 출력을 거부한다", () => {
        expect(CONTRACT.steps.consecutiveFromOne).toBe(true);
        expect(RECIPE_SCAN_SPEC.outputSchema.safeParse(candidateWithStepOrders([1, 2])).success).toBe(true);
        expect(RECIPE_SCAN_SPEC.outputSchema.safeParse(candidateWithStepOrders([1, 3])).success).toBe(false);
    });
});

describe("도구 설명", () => {
    it("골든 계약과 같은 문장을 모델에게 보인다", () => {
        const shown = Object.fromEntries(RECIPE_SCAN_TOOLS.map((spec) => [spec.name, spec.description]));

        expect(shown).toEqual(CONTRACT.descriptions);
    });
});
