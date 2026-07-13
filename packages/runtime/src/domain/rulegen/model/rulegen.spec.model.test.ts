import {RULE_GENERATION_FOCUS} from "@monitor/kernel/job/job.const.js";
import {describe, expect, it} from "vitest";
import type {RuleGenerationEvidence} from "~runtime/domain/rulegen/model/evidence.model.js";
import {SEVERITY_CLAUSE, SEVERITY_HEADING} from "~runtime/domain/rulegen/model/severity.clause.model.js";
import {buildRuleGenerationSpec} from "~runtime/domain/rulegen/model/rulegen.spec.model.js";

const EMPTY_EVIDENCE: RuleGenerationEvidence = {turns: [], events: [], existingRules: []};

function specFor(overrides: Record<string, unknown> = {}) {
    return buildRuleGenerationSpec(
        {jobId: "job-1", taskId: "task-1", workspacePath: "/tmp/ws", ...overrides},
        EMPTY_EVIDENCE,
    );
}

describe("buildRuleGenerationSpec", () => {
    it("수동 생성은 전체 태스크 경로와 3-5개 상한을 쓴다", () => {
        const spec = specFor();

        expect(spec.systemPrompt).toContain("turn by turn");
        expect(spec.systemPrompt).toContain("Output exactly 3-5 rules.");
        expect(spec.systemPrompt).not.toContain("Do NOT read the whole task");
        expect(spec.maxRules).toBe(5);
    });

    it("수동 생성도 상한이 3보다 작으면 하한을 함께 낮춘다", () => {
        expect(specFor({maxRules: 2}).systemPrompt).toContain("Output exactly 2 rules.");
    });

    it("자동 트리거는 최근 턴 경로와 1-2개 상한을 쓴다", () => {
        const spec = specFor({focus: RULE_GENERATION_FOCUS.recent});

        expect(spec.systemPrompt).toContain("Do NOT read the whole task");
        expect(spec.systemPrompt).toContain("Output 1-2 rules");
        expect(spec.systemPrompt).toContain("EMPTY rules array");
        expect(spec.maxRules).toBe(2);
    });

    it("심각도 절은 두 모드가 같고 문턱 문구만 다르다", () => {
        const manual = specFor().systemPrompt;
        const recent = specFor({focus: RULE_GENERATION_FOCUS.recent}).systemPrompt;

        for (const clause of Object.values(SEVERITY_CLAUSE)) {
            expect(manual).toContain(clause);
            expect(recent).toContain(clause);
        }
        expect(manual).toContain(SEVERITY_HEADING.manual);
        expect(recent).toContain(SEVERITY_HEADING.recent);
        expect(manual).not.toContain(SEVERITY_HEADING.recent);
        expect(recent).not.toContain(SEVERITY_HEADING.manual);
    });

    it("의도를 주면 사용자 프롬프트에 태그로 싣고 조향 지침을 붙인다", () => {
        const spec = specFor({intent: "린트를 돌렸는지 확인"});

        expect(spec.userPrompt).toContain("<operator-intent>\n린트를 돌렸는지 확인\n</operator-intent>");
        expect(spec.systemPrompt).toContain("Operator intent:");
        expect(spec.systemPrompt).toContain("UNTRUSTED DATA");
    });

    it("의도가 없으면 프롬프트에 의도 태그도 지침도 남기지 않는다", () => {
        const spec = specFor();

        expect(spec.userPrompt).not.toContain("operator-intent");
        expect(spec.systemPrompt).not.toContain("Operator intent:");
    });

    it("앵커 입력을 주면 그 입력만 검증하라는 지침을 붙인다", () => {
        const spec = specFor({anchorText: "테스트 돌리고 커밋해"});

        expect(spec.userPrompt).toContain("<anchor-input>\n테스트 돌리고 커밋해\n</anchor-input>");
        expect(spec.systemPrompt).toContain("it is the ONE user input these rules must verify");
    });

    it("근거를 프롬프트의 데이터 영역에 태그로 싣는다", () => {
        const spec = buildRuleGenerationSpec(
            {jobId: "job-1", taskId: "task-1", workspacePath: "/tmp/ws"},
            {
                turns: [{turnIndex: 1, askedText: "테스트 돌려", assistantSummary: "돌렸다"}],
                events: [{kind: "execute_tool", title: "npm test", body: ""}],
                existingRules: [{name: "기존 규칙", trigger: null, expect: null}],
            },
        );

        expect(spec.userPrompt).toContain("<task-turns>");
        expect(spec.userPrompt).toContain("테스트 돌려");
        expect(spec.userPrompt).toContain("<task-events>");
        expect(spec.userPrompt).toContain("<existing-rules>");
        expect(spec.userPrompt).toContain("기존 규칙");
    });

    it("출력 스키마는 이름과 기대 조건과 근거만 필수로 요구한다", () => {
        const rules = specFor().outputSchema["properties"] as {rules: {items: Record<string, unknown>}};

        expect(rules.rules.items["required"]).toEqual(["name", "expect", "rationale"]);
    });
});
