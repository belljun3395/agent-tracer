import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CHAT_TOOLS, chatToolArgSpecs } from "@monitor/kernel";
import { CHAT_TOOL_CONTRACT, CHAT_TOOL_DEFINITIONS, CHAT_TOOL_SHAPES } from "./chat.tool.schema.js";

describe("chat 도구 계약 정합성", () => {
    it("도구 이름 집합이 커널 계약과 바이트 단위로 같다", () => {
        expect(CHAT_TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual([...CHAT_TOOLS]);
    });

    it("각 도구의 설명이 커널 계약의 설명과 같다", () => {
        for (const tool of CHAT_TOOL_DEFINITIONS) {
            expect(tool.description).toBe(CHAT_TOOL_CONTRACT.descriptions[tool.name]);
        }
    });

    it("각 도구의 shape 키가 계약의 required·optional 합집합과 같다", () => {
        for (const name of CHAT_TOOLS) {
            const spec = CHAT_TOOL_CONTRACT.tools[name]!;
            const expected = [...spec.required, ...spec.optional].sort();
            expect(Object.keys(CHAT_TOOL_SHAPES[name]!).sort()).toEqual(expected);
        }
    });

    it("열거 인자는 계약의 허용값만 통과시킨다", () => {
        for (const name of CHAT_TOOLS) {
            const spec = CHAT_TOOL_CONTRACT.tools[name]!;
            const object = z.object(CHAT_TOOL_SHAPES[name]!);
            for (const [arg, argSpec] of chatToolArgSpecs(spec)) {
                if (!("values" in argSpec)) continue;
                const good = buildRequired(spec.required, arg, argSpec.values[0]!);
                expect(object.safeParse(good).success).toBe(true);
                const bad = buildRequired(spec.required, arg, "__not_a_value__");
                expect(object.safeParse(bad).success).toBe(false);
            }
        }
    });

    it("수치 인자는 계약의 상하한 밖을 거절한다", () => {
        for (const name of CHAT_TOOLS) {
            const spec = CHAT_TOOL_CONTRACT.tools[name]!;
            const object = z.object(CHAT_TOOL_SHAPES[name]!);
            for (const [arg, argSpec] of chatToolArgSpecs(spec)) {
                if (!("max" in argSpec)) continue;
                const overCap = buildRequired(spec.required, arg, argSpec.max + 1);
                expect(object.safeParse(overCap).success).toBe(false);
            }
        }
    });
});

function buildRequired(required: readonly string[], arg: string, value: unknown): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of required) out[key] = "x";
    out[arg] = value;
    return out;
}
