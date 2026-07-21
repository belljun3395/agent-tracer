import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CHAT_TOOLS, chatToolArgSpecs, type ChatToolArgSpec } from "@monitor/kernel";
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
            const argSpecs = chatToolArgSpecs(spec);
            for (const [arg, argSpec] of argSpecs) {
                if (!("values" in argSpec)) continue;
                const good = buildRequired(spec.required, argSpecs, arg, argSpec.values[0]!);
                expect(object.safeParse(good).success).toBe(true);
                const bad = buildRequired(spec.required, argSpecs, arg, "__not_a_value__");
                expect(object.safeParse(bad).success).toBe(false);
            }
        }
    });

    it("수치 인자는 계약의 상하한 밖을 거절한다", () => {
        for (const name of CHAT_TOOLS) {
            const spec = CHAT_TOOL_CONTRACT.tools[name]!;
            const object = z.object(CHAT_TOOL_SHAPES[name]!);
            const argSpecs = chatToolArgSpecs(spec);
            for (const [arg, argSpec] of argSpecs) {
                if (!("max" in argSpec)) continue;
                const overCap = buildRequired(spec.required, argSpecs, arg, argSpec.max + 1);
                expect(object.safeParse(overCap).success).toBe(false);
            }
        }
    });
});

// 필수 인자 스스로가 열거값이면(e.g. enqueue_job의 kind) "x" 채움값이 그 인자의 제약을 어기므로,
// 채울 때 그 인자 자신의 첫 허용값을 쓴다.
function buildRequired(
    required: readonly string[],
    argSpecs: ReadonlyMap<string, ChatToolArgSpec>,
    arg: string,
    value: unknown,
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of required) {
        const keySpec = argSpecs.get(key);
        out[key] = keySpec !== undefined && "values" in keySpec ? keySpec.values[0] : "x";
    }
    out[arg] = value;
    return out;
}
