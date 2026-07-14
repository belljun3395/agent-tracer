import {describe, expect, it} from "vitest";
import {buildRulegenTools} from "~runtime/domain/rulegen/adapter/rulegen.tool.schema.js";
import {
    RULEGEN_EVENT_LIMIT,
    RULEGEN_TOOL,
    RULEGEN_TOOL_SPECS,
    type RulegenToolInput,
    type RulegenToolset,
} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";

const calls: {name: string; input: RulegenToolInput}[] = [];

const TOOLSET: RulegenToolset = {
    [RULEGEN_TOOL.turns]: async (input) => {
        calls.push({name: RULEGEN_TOOL.turns, input});
        return "턴 근거";
    },
    [RULEGEN_TOOL.events]: async (input) => {
        calls.push({name: RULEGEN_TOOL.events, input});
        return "이벤트 근거";
    },
    [RULEGEN_TOOL.rules]: async (input) => {
        calls.push({name: RULEGEN_TOOL.rules, input});
        return "규칙 근거";
    },
};

function toolNamed(name: string) {
    const definition = buildRulegenTools(RULEGEN_TOOL_SPECS, TOOLSET).find((item) => item.name === name);
    if (definition === undefined) throw new Error(`도구를 렌더링하지 못했다: ${name}`);
    return definition;
}

describe("buildRulegenTools", () => {
    it("명세에 있는 도구를 전부 렌더링한다", () => {
        const names = buildRulegenTools(RULEGEN_TOOL_SPECS, TOOLSET).map((definition) => definition.name);

        expect(names).toEqual(Object.values(RULEGEN_TOOL));
    });

    it("도구를 부르면 도메인 핸들러의 텍스트를 그대로 돌려준다", async () => {
        calls.length = 0;

        const result = await toolNamed(RULEGEN_TOOL.turns).handler({taskId: "task-1"}, undefined);

        expect(calls).toEqual([{name: RULEGEN_TOOL.turns, input: {taskId: "task-1"}}]);
        expect(result.content).toEqual([{type: "text", text: "턴 근거"}]);
    });

    it("이벤트 도구의 인자 스키마는 상한 범위를 벗어난 값을 거부한다", () => {
        const schema = toolNamed(RULEGEN_TOOL.events).inputSchema;

        expect(schema["limit"]?.safeParse(RULEGEN_EVENT_LIMIT.max).success).toBe(true);
        expect(schema["limit"]?.safeParse(RULEGEN_EVENT_LIMIT.max + 1).success).toBe(false);
        expect(schema["limit"]?.safeParse(undefined).success).toBe(true);
        expect(schema["taskId"]?.safeParse(undefined).success).toBe(false);
    });
});
