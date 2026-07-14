import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";
import {RULE_EXPECTATION_KIND} from "@monitor/kernel/rule/definition/rule.vocabulary.js";
import type {RuleProposalPayload} from "@monitor/kernel/rule/proposal/rule.proposal.schema.js";
import {digestEvents, digestExistingRules, digestTurns} from "~runtime/domain/rulegen/model/evidence.model.js";
import {buildRuleOutputSchema} from "~runtime/domain/rulegen/model/output.schema.model.js";
import {
    RULEGEN_REPAIR_ATTEMPTS,
    groundRuleProposals,
} from "~runtime/domain/rulegen/model/proposal.grounding.model.js";
import {CITATION_MAX, validateRuleProposals} from "~runtime/domain/rulegen/model/proposal.validation.model.js";
import type {RulegenProvenanceSnapshot} from "~runtime/domain/rulegen/model/rulegen.provenance.model.js";
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
    readonly responseFields: string[];
}

interface CitationContract {
    readonly source: string;
    readonly min: number;
    readonly max: number;
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
        readonly citations: Readonly<Record<string, CitationContract>>;
    };
    readonly grounding: {
        readonly ledgerSources: string[];
        readonly repairAttempts: number;
        readonly onUngrounded: string;
    };
};

const SPEC = buildRuleGenerationSpec({jobId: "job-1", taskId: "task-1", workspacePath: "/tmp/ws"});

function partitionFields(spec: RulegenToolSpec): {readonly required: string[]; readonly optional: string[]} {
    const required: string[] = [];
    const optional: string[] = [];
    for (const param of spec.params) (param.optional ? optional : required).push(param.name);
    return {required, optional};
}

const SNAPSHOT: RulegenProvenanceSnapshot = {turnIds: ["turn-1"], eventIds: ["event-1"]};

function proposalWith(overrides: Record<string, unknown>): unknown {
    return {
        name: "테스트 실행",
        expect: {kind: "command", commandMatches: ["npm test"]},
        citedTurnIds: ["turn-1"],
        citedEventIds: ["event-1"],
        ...overrides,
    };
}

function groundedOf(candidates: readonly unknown[]): readonly RuleProposalPayload[] {
    return groundRuleProposals(validateRuleProposals(candidates).accepted, SNAPSHOT).grounded;
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

    it("도구 응답이 모델이 인용할 식별자를 담는다", () => {
        const turns = digestTurns([{id: "turn-1", turnIndex: 1, askedText: "테스트 돌려", assistantText: "돌렸다"}]);
        const events = digestEvents([{id: "event-1", turnId: "turn-1", kind: "execute_tool", title: "t", body: "b"}]);
        const rules = digestExistingRules([{name: "기존", expectation: null}]);

        expect(Object.keys(turns[0]!)).toEqual(CONTRACT.tools["get_task_turns"]!.responseFields);
        expect(Object.keys(events[0]!)).toEqual(CONTRACT.tools["get_task_events"]!.responseFields);
        expect(Object.keys(rules[0]!)).toEqual(CONTRACT.tools["list_rules"]!.responseFields);
    });

    it("규칙 제안의 필수 필드가 골든 계약과 같다", () => {
        expect(outputSchemaItem()["required"]).toEqual(CONTRACT.proposal.required);
        expect(validateRuleProposals([proposalWith({})]).accepted).toHaveLength(1);
        expect(validateRuleProposals([{expect: {kind: "command", commandMatches: ["npm test"]}}]).rejected)
            .toHaveLength(1);
    });

    it("인용 목록의 출처와 상하한이 골든 계약과 같다", () => {
        const {citedTurnIds, citedEventIds} = CONTRACT.proposal.citations;
        const properties = outputSchemaItem()["properties"] as Record<string, Record<string, unknown>>;

        expect(Object.keys(CONTRACT.tools)).toContain(citedTurnIds!.source);
        expect(Object.keys(CONTRACT.tools)).toContain(citedEventIds!.source);
        expect(properties["citedTurnIds"]!["maxItems"]).toBe(citedTurnIds!.max);
        expect(properties["citedEventIds"]!["maxItems"]).toBe(citedEventIds!.max);
        expect(CITATION_MAX).toBe(citedTurnIds!.max);
        expect(groundedOf([proposalWith({citedTurnIds: []})])).toHaveLength(citedTurnIds!.min - 1);
        expect(groundedOf([proposalWith({citedEventIds: []})])).toHaveLength(1);
    });

    it("도구가 돌려준 적 없는 식별자를 인용한 제안은 근거가 서지 않는다", () => {
        expect(groundedOf([proposalWith({})])).toHaveLength(1);
        expect(groundedOf([proposalWith({citedEventIds: ["event-999"]})])).toEqual([]);
        expect(groundedOf([proposalWith({citedTurnIds: ["turn-999"]})])).toEqual([]);
    });

    it("근거 장부의 출처와 수리 횟수와 처분이 골든 계약과 같다", () => {
        expect(RULEGEN_REPAIR_ATTEMPTS).toBe(CONTRACT.grounding.repairAttempts);
        expect(CONTRACT.grounding.onUngrounded).toBe("drop");
        for (const source of CONTRACT.grounding.ledgerSources) {
            expect(Object.keys(CONTRACT.tools)).toContain(source);
        }
        expect(SPEC.systemPrompt).toContain(`${RULEGEN_REPAIR_ATTEMPTS} repair attempt`);
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
