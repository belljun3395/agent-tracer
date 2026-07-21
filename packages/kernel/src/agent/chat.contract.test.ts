import { describe, expect, it } from "vitest";
import { AGENT } from "./agent.const.js";
import {
    CHAT_MUTATION_TOOLS,
    CHAT_TOOL,
    CHAT_TOOLS,
    chatToolArgSpecs,
    type ChatToolArgEnum,
    type ChatToolArgNumber,
    type ChatToolArgSpec,
} from "./chat.contract.js";
import { loadChatToolContract } from "./chat.contract.fixture.js";

const CONTRACT = loadChatToolContract();
const RAW = CONTRACT as unknown as Record<string, unknown>;

function isNumberSpec(spec: ChatToolArgSpec): spec is ChatToolArgNumber {
    return "min" in spec && "max" in spec;
}

function isEnumSpec(spec: ChatToolArgSpec): spec is ChatToolArgEnum {
    return "values" in spec;
}

describe("chat 에이전트 등록", () => {
    it("chat은 jobKind 없이 id와 라우트만 갖는 대화 에이전트다", () => {
        expect(AGENT.chat.id).toBe("chat");
        expect(AGENT.chat.route).toBe("/agents/chat");
        expect("jobKind" in AGENT.chat).toBe(false);
    });
});

describe("chat 도구 계약", () => {
    it("커널 상수가 여는 도구 이름이 계약 픽스처와 같다", () => {
        expect(new Set(CHAT_TOOLS)).toEqual(new Set(Object.keys(CONTRACT.tools)));
        expect(new Set(Object.values(CHAT_TOOL))).toEqual(new Set(CHAT_TOOLS));
    });

    it("모든 도구에 설명과 응답 본문 계약이 있다", () => {
        expect(new Set(Object.keys(CONTRACT.descriptions))).toEqual(new Set(CHAT_TOOLS));
        expect(new Set(Object.keys(CONTRACT.responses))).toEqual(new Set(CHAT_TOOLS));

        for (const name of CHAT_TOOLS) {
            expect(CONTRACT.descriptions[name]?.trim().length ?? 0).toBeGreaterThan(0);

            const response = CONTRACT.responses[name]!;
            const shapes = Object.entries(response);
            expect(shapes.length).toBeGreaterThan(0);
            for (const [, fields] of shapes) {
                expect(Array.isArray(fields)).toBe(true);
                expect(fields.length).toBeGreaterThan(0);
                for (const field of fields) {
                    expect(typeof field).toBe("string");
                    expect(field.length).toBeGreaterThan(0);
                }
            }
        }
    });

    it("도구마다 필수·선택 인자가 서로소이고 인자 제약이 그 목록 안을 가리킨다", () => {
        for (const name of CHAT_TOOLS) {
            const spec = CONTRACT.tools[name]!;
            expect(Array.isArray(spec.required)).toBe(true);
            expect(Array.isArray(spec.optional)).toBe(true);

            const declared = new Set([...spec.required, ...spec.optional]);
            expect(declared.size).toBe(spec.required.length + spec.optional.length);

            for (const [arg, argSpec] of chatToolArgSpecs(spec)) {
                expect(declared.has(arg)).toBe(true);
                if (isNumberSpec(argSpec)) {
                    expect(argSpec.min).toBeLessThanOrEqual(argSpec.default);
                    expect(argSpec.default).toBeLessThanOrEqual(argSpec.max);
                } else if (isEnumSpec(argSpec)) {
                    expect(argSpec.values.length).toBeGreaterThan(0);
                    if (argSpec.default !== undefined) {
                        expect(argSpec.values).toContain(argSpec.default);
                    }
                } else {
                    throw new Error(`${name}.${arg} is neither a number nor an enum arg spec`);
                }
            }
        }
    });

    it("mutation 플래그가 도구마다 있고, mutation 집합이 픽스처의 쓰기 도구와 정확히 같다", () => {
        const flagged: string[] = [];
        for (const name of CHAT_TOOLS) {
            const spec = CONTRACT.tools[name]!;
            expect(typeof spec.mutation).toBe("boolean");
            if (spec.mutation) {
                flagged.push(name);
            }
        }
        expect(new Set(flagged)).toEqual(new Set(CHAT_MUTATION_TOOLS));
        // 확인 게이트를 세워야 하는 쓰기 도구가 실제로 존재하고, 모든 mutation 도구가 상수에 올라 있다.
        expect(CHAT_MUTATION_TOOLS.length).toBeGreaterThan(0);
        expect(new Set(CHAT_MUTATION_TOOLS).size).toBe(CHAT_MUTATION_TOOLS.length);
        for (const name of CHAT_MUTATION_TOOLS) {
            expect(CONTRACT.tools[name]?.mutation).toBe(true);
        }
    });

    it("턴당 예산이 폭주 백스톱과 달러·토큰 상한으로만 이뤄지고 분해 계약이 없다", () => {
        expect(Number.isInteger(CONTRACT.maxTurns)).toBe(true);
        expect(CONTRACT.maxTurns).toBeGreaterThanOrEqual(12);
        expect(CONTRACT.maxTurns).toBeLessThanOrEqual(16);
        expect(CONTRACT.limits.maxOutputTokens).toBeGreaterThan(0);
        expect(CONTRACT.limits.maxBudgetUsd).toBeGreaterThan(0);
        // chat은 잡을 분해하지도 구조화 출력을 내지도 않으므로 이 계약을 갖지 않는다.
        expect("orchestration" in RAW).toBe(false);
        expect("outputKinds" in RAW).toBe(false);
    });
});
