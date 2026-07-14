import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";
import {RULE_EXPECTATION_KIND} from "@monitor/kernel/rule/definition/rule.vocabulary.js";
import {buildRuleOutputSchema} from "~runtime/domain/rulegen/model/output.schema.model.js";
import {validateRuleProposals} from "~runtime/domain/rulegen/model/proposal.validation.model.js";
import {buildRuleGenerationSpec} from "~runtime/domain/rulegen/model/rulegen.spec.model.js";
import {
    RULEGEN_EVENT_LIMIT,
    RULEGEN_TOOL_SPECS,
    RULEGEN_WORKSPACE_TOOLS,
    resolveEventLimit,
    type RulegenToolSpec,
} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";

interface NumberContract {
    readonly default: number;
    readonly min: number;
    readonly max: number;
}

interface ToolContract {
    readonly required: string[];
    readonly optional: string[];
    readonly numbers?: Readonly<Record<string, NumberContract>>;
}

// 두 백엔드가 같은 파일을 읽어야 한쪽만 바뀌는 드리프트가 남지 않는다.
const CONTRACT = JSON.parse(
    readFileSync(
        new URL("../../../../../kernel/src/agent/__fixtures__/rule.generation.tool.contract.json", import.meta.url),
        "utf8",
    ),
) as {
    readonly maxTurns: number;
    readonly limits: {
        readonly maxBudgetUsd: number;
        readonly maxOutputTokens: number;
        readonly deadlineMs: number;
        readonly effort: string;
    };
    readonly tools: Readonly<Record<string, ToolContract>>;
    readonly workspaceTools: string[];
    readonly proposal: {
        readonly required: string[];
        readonly optional: string[];
        readonly expectKinds: string[];
    };
};

const SPEC = buildRuleGenerationSpec({jobId: "job-1", taskId: "task-1", workspacePath: "/tmp/ws"});

function partitionFields(spec: RulegenToolSpec): {readonly required: string[]; readonly optional: string[]} {
    const required: string[] = [];
    const optional: string[] = [];
    for (const param of spec.params) (param.optional ? optional : required).push(param.name);
    return {required, optional};
}

function proposalWith(overrides: Record<string, unknown>): unknown {
    return {name: "테스트 실행", expect: {kind: "command", commandMatches: ["npm test"]}, ...overrides};
}

function outputSchemaItem(): Record<string, unknown> {
    const rules = buildRuleOutputSchema()["properties"] as Record<string, Record<string, unknown>>;
    return rules["rules"]!["items"] as Record<string, unknown>;
}

describe("rule-generation 도구 계약", () => {
    it("턴 예산이 골든 계약과 같다", () => {
        expect(SPEC.maxTurns).toBe(CONTRACT.maxTurns);
    });

    it("비용과 토큰과 시간과 추론 강도의 예산이 골든 계약과 같다", () => {
        expect(SPEC.maxBudgetUsd).toBe(CONTRACT.limits.maxBudgetUsd);
        expect(SPEC.maxOutputTokens).toBe(CONTRACT.limits.maxOutputTokens);
        expect(SPEC.deadlineMs).toBe(CONTRACT.limits.deadlineMs);
        expect(SPEC.effort).toBe(CONTRACT.limits.effort);
    });

    it("모델에게 노출하는 도구 이름이 골든 계약과 같다", () => {
        expect(RULEGEN_TOOL_SPECS.map((tool) => tool.name)).toEqual(Object.keys(CONTRACT.tools));
    });

    it("워크스페이스 도구가 골든 계약과 같다", () => {
        expect([...RULEGEN_WORKSPACE_TOOLS]).toEqual(CONTRACT.workspaceTools);
    });

    it("도구마다 필수와 선택 인자가 골든 계약과 같다", () => {
        for (const spec of RULEGEN_TOOL_SPECS) {
            const contract = CONTRACT.tools[spec.name]!;
            const {required, optional} = partitionFields(spec);

            expect(new Set(required)).toEqual(new Set(contract.required));
            expect(new Set(optional)).toEqual(new Set(contract.optional));
        }
    });

    it("이벤트 상한의 기본값과 상하한이 골든 계약과 같다", () => {
        const bound = CONTRACT.tools["get_task_events"]!.numbers!["limit"]!;

        expect(RULEGEN_EVENT_LIMIT.fallback).toBe(bound.default);
        expect(RULEGEN_EVENT_LIMIT.min).toBe(bound.min);
        expect(RULEGEN_EVENT_LIMIT.max).toBe(bound.max);
        expect(resolveEventLimit(undefined)).toBe(bound.default);
        expect(resolveEventLimit(bound.min - 1)).toBe(bound.min);
        expect(resolveEventLimit(bound.max + 1)).toBe(bound.max);
    });

    it("규칙 제안의 필수 필드가 골든 계약과 같다", () => {
        expect(outputSchemaItem()["required"]).toEqual(CONTRACT.proposal.required);
        expect(validateRuleProposals([proposalWith({})]).accepted).toHaveLength(1);
        expect(validateRuleProposals([{expect: {kind: "command", commandMatches: ["npm test"]}}]).rejected)
            .toHaveLength(1);
    });

    it("규칙 제안의 선택 필드는 없어도 받아들인다", () => {
        const properties = outputSchemaItem()["properties"] as Record<string, unknown>;

        for (const field of CONTRACT.proposal.optional) {
            expect(properties[field]).toBeDefined();
            expect(outputSchemaItem()["required"]).not.toContain(field);
        }
        expect(validateRuleProposals([proposalWith({rationale: undefined, severity: undefined})]).accepted)
            .toHaveLength(1);
    });

    it("기대 종류가 골든 계약과 같다", () => {
        expect(Object.values(RULE_EXPECTATION_KIND)).toEqual(CONTRACT.proposal.expectKinds);
    });
});
