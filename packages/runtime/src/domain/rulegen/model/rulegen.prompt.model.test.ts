import {describe, expect, it} from "vitest";
import {RULEGEN_REPAIR_ATTEMPTS} from "~runtime/domain/rulegen/model/proposal.grounding.model.js";
import {buildRuleProposalPolicy} from "~runtime/domain/rulegen/model/proposal.policy.model.js";
import {RULEGEN_MODE, type RulegenMode} from "~runtime/domain/rulegen/model/rulegen.mode.model.js";
import {
    buildRulegenRepairPrompt,
    buildRulegenSystemPrompt,
    buildRulegenUserPrompt,
    type RulegenPromptOptions,
} from "~runtime/domain/rulegen/model/rulegen.prompt.model.js";
import {
    RULEGEN_TOOL_SPECS,
    RULEGEN_WORKSPACE_TOOLS,
    rulegenToolFullName,
} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";

function optionsFor(mode: RulegenMode, overrides: Partial<RulegenPromptOptions> = {}): RulegenPromptOptions {
    return {
        mode,
        maxRules: 5,
        maxTurns: 15,
        language: "auto",
        anchorDirective: "",
        intentDirective: "",
        tools: RULEGEN_TOOL_SPECS,
        ...overrides,
    };
}

describe("buildRulegenSystemPrompt", () => {
    it("역할과 도구 목록과 인용 규칙과 제안 정책을 한 프롬프트로 조립한다", () => {
        const options = optionsFor(RULEGEN_MODE.manual);
        const prompt = buildRulegenSystemPrompt(options);

        expect(prompt).toContain("verification-rule designer");
        expect(prompt).toContain("Tools available:");
        expect(prompt).toContain("A deterministic verifier checks every ID you cite");
        expect(prompt).toContain(buildRuleProposalPolicy(options));
        expect(prompt).toContain("Return JSON conforming to the provided schema");
    });

    it("도구 목록은 실행 중에 부를 도구의 정식 명칭과 워크스페이스 읽기 도구를 함께 편다", () => {
        const prompt = buildRulegenSystemPrompt(optionsFor(RULEGEN_MODE.manual));

        for (const spec of RULEGEN_TOOL_SPECS) {
            expect(prompt).toContain(rulegenToolFullName(spec.name));
        }
        for (const tool of RULEGEN_WORKSPACE_TOOLS) {
            expect(prompt).toContain(tool);
        }
    });

    it("수동 생성은 전체 태스크를 턴 단위로 읽는 경로를 싣고 최근-턴 경고는 빼놓는다", () => {
        const prompt = buildRulegenSystemPrompt(optionsFor(RULEGEN_MODE.manual));

        expect(prompt).toContain("Read the task turns turn by turn");
        expect(prompt).not.toContain("This is an AUTO rule-generation job");
        expect(prompt).not.toContain("Do NOT read the whole task");
    });

    it("자동 트리거는 최근 턴만 보라는 경고와 기존 규칙을 먼저 훑는 경로를 싣는다", () => {
        const prompt = buildRulegenSystemPrompt(optionsFor(RULEGEN_MODE.recent, {maxRules: 2}));

        expect(prompt).toContain("This is an AUTO rule-generation job");
        expect(prompt).toContain("List the existing rules FIRST");
        expect(prompt).toContain("Do NOT read the whole task");
    });
});

describe("buildRulegenUserPrompt", () => {
    it("태스크와 워크스페이스와 앵커·의도 블록과 상한을 데이터로 싣는다", () => {
        const prompt = buildRulegenUserPrompt({
            taskId: "task-1",
            workspacePath: "/tmp/ws",
            maxRules: 4,
            anchorBlock: "<anchor>",
            intentBlock: "<intent>",
        });

        expect(prompt).toContain("Task ID: task-1");
        expect(prompt).toContain("Workspace: /tmp/ws");
        expect(prompt).toContain("<anchor>");
        expect(prompt).toContain("<intent>");
        expect(prompt).toContain("Propose up to 4 rules for task task-1.");
    });
});

describe("buildRulegenRepairPrompt", () => {
    it("직전 출력과 검증 오류를 다시 실어 한 번의 수리만 요청한다", () => {
        const prompt = buildRulegenRepairPrompt(
            "SYSTEM-PROMPT",
            {rules: [{name: "x"}]},
            ["cited turn unknown", "cited event unknown"],
        );

        expect(prompt).toContain("SYSTEM-PROMPT");
        expect(prompt).toContain("Your previous output:");
        expect(prompt).toContain(JSON.stringify({rules: [{name: "x"}]}));
        expect(prompt).toContain("  - cited turn unknown");
        expect(prompt).toContain("  - cited event unknown");
        expect(prompt).toContain(`You get ${RULEGEN_REPAIR_ATTEMPTS} repair attempt`);
        expect(prompt).toContain("Then return the complete rule list.");
    });
});
