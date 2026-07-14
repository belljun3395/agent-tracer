import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildTitleContext, RECENT_TURN_LIMIT, type TitleTurn } from "./title.context.model.js";
import { TITLE_SUGGESTION_MAX_TURNS } from "./title.prompt.js";
import { TITLE_SUGGESTION_SPEC } from "./title.spec.js";
import {
    DEFAULT_EVENT_LIMIT,
    DEFAULT_EVENT_ORDER,
    EVENT_ORDER,
    MAX_EVENT_LIMIT,
    MIN_EVENT_LIMIT,
    TITLE_SUGGESTION_TOOL,
    TITLE_SUGGESTION_TOOLS,
} from "./title.tool.schema.js";

// 두 언어가 같은 파일을 읽어야 한쪽만 바뀌는 드리프트가 남지 않는다.
const CONTRACT = JSON.parse(
    readFileSync(
        new URL(
            "../../../../../../../kernel/src/agent/__fixtures__/title.suggestion.tool.contract.json",
            import.meta.url,
        ),
        "utf8",
    ),
) as {
    readonly maxTurns: number;
    readonly limits: {
        readonly recentTurnLimit: number;
        readonly maxContextTurns: number;
        readonly maxOutputTokens: number;
        readonly maxBudgetUsd: number;
    };
    readonly getTaskEvents: {
        readonly required: string[];
        readonly optional: string[];
        readonly limit: { readonly default: number; readonly min: number; readonly max: number };
        readonly order: { readonly default: string; readonly values: string[] };
    };
};

function partitionGetTaskEventsFields(): { readonly required: string[]; readonly optional: string[] } {
    const spec = TITLE_SUGGESTION_TOOLS.find((tool) => tool.name === TITLE_SUGGESTION_TOOL.getTaskEvents);
    const required: string[] = [];
    const optional: string[] = [];
    for (const [field, schema] of Object.entries(spec!.shape)) {
        (schema.safeParse(undefined).success ? optional : required).push(field);
    }
    return { required, optional };
}

function limitAccepts(value: number): boolean {
    const spec = TITLE_SUGGESTION_TOOLS.find((tool) => tool.name === TITLE_SUGGESTION_TOOL.getTaskEvents);
    return spec!.shape["limit"]!.safeParse(value).success;
}

function buildContextFrom(turnCount: number): { readonly turns: readonly TitleTurn[] } {
    const turns: TitleTurn[] = Array.from({ length: turnCount }, (_value, index) => ({
        turnIndex: index,
        askedText: `ask ${index}`,
        assistantText: null,
    }));
    return buildTitleContext({ title: "Untitled", status: "completed" }, turns, turnCount * 3);
}

describe("title-suggestion 도구 계약", () => {
    it("턴 예산이 골든 계약과 같다", () => {
        expect(TITLE_SUGGESTION_MAX_TURNS).toBe(CONTRACT.maxTurns);
    });

    it("토큰과 비용 예산이 골든 계약과 같다", () => {
        expect(TITLE_SUGGESTION_SPEC.limits.maxOutputTokens).toBe(CONTRACT.limits.maxOutputTokens);
        expect(TITLE_SUGGESTION_SPEC.limits.maxBudgetUsd).toBe(CONTRACT.limits.maxBudgetUsd);
    });

    it("최근 턴 창과 컨텍스트가 싣는 턴 수의 상한이 골든 계약과 같다", () => {
        expect(RECENT_TURN_LIMIT).toBe(CONTRACT.limits.recentTurnLimit);
        expect(buildContextFrom(CONTRACT.limits.maxContextTurns).turns).toHaveLength(
            CONTRACT.limits.maxContextTurns,
        );
        expect(buildContextFrom(CONTRACT.limits.maxContextTurns + 50).turns).toHaveLength(
            CONTRACT.limits.maxContextTurns,
        );
    });

    it("get_task_events의 필수와 선택 인자가 골든 계약과 같다", () => {
        const { required, optional } = partitionGetTaskEventsFields();

        expect(new Set(required)).toEqual(new Set(CONTRACT.getTaskEvents.required));
        expect(new Set(optional)).toEqual(new Set(CONTRACT.getTaskEvents.optional));
    });

    it("limit의 기본값과 최소와 최대가 골든 계약과 같다", () => {
        expect(DEFAULT_EVENT_LIMIT).toBe(CONTRACT.getTaskEvents.limit.default);
        expect(MIN_EVENT_LIMIT).toBe(CONTRACT.getTaskEvents.limit.min);
        expect(MAX_EVENT_LIMIT).toBe(CONTRACT.getTaskEvents.limit.max);
    });

    it("limit이 골든 계약의 상한 밖을 거부한다", () => {
        expect(limitAccepts(CONTRACT.getTaskEvents.limit.max)).toBe(true);
        expect(limitAccepts(CONTRACT.getTaskEvents.limit.max + 1)).toBe(false);
        expect(limitAccepts(CONTRACT.getTaskEvents.limit.min - 1)).toBe(false);
    });

    it("읽기 방향의 기본값과 허용 값이 골든 계약과 같다", () => {
        expect(DEFAULT_EVENT_ORDER).toBe(CONTRACT.getTaskEvents.order.default);
        expect(Object.values(EVENT_ORDER)).toEqual(CONTRACT.getTaskEvents.order.values);
    });
});
