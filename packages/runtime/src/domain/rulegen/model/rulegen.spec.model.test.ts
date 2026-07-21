import {RULE_GENERATION_FOCUS} from "@monitor/kernel/job/job.const.js";
import {describe, expect, it} from "vitest";
import {buildAnchorBlock, buildAnchorDirective} from "~runtime/domain/rulegen/model/anchor.model.js";
import {DEFAULT_RULEGEN_DEADLINE_MS} from "~runtime/domain/rulegen/model/deadline.model.js";
import {buildIntentBlock, buildIntentDirective} from "~runtime/domain/rulegen/model/intent.model.js";
import {RULEGEN_MODE} from "~runtime/domain/rulegen/model/rulegen.mode.model.js";
import {buildRuleOutputSchema} from "~runtime/domain/rulegen/model/output.schema.model.js";
import {
    buildRulegenSystemPrompt,
    buildRulegenUserPrompt,
} from "~runtime/domain/rulegen/model/rulegen.prompt.model.js";
import {
    DEFAULT_RULEGEN_BUDGET_USD,
    DEFAULT_RULEGEN_LANGUAGE,
    DEFAULT_RULEGEN_MODEL,
    RULEGEN_EFFORT,
    RULEGEN_FALLBACK_MODEL,
    RULEGEN_MAX_OUTPUT_TOKENS,
    RULEGEN_MAX_TURNS,
    buildRuleGenerationSpec,
} from "~runtime/domain/rulegen/model/rulegen.spec.model.js";
import {RULEGEN_TOOL_SPECS} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";

function specFor(overrides: Record<string, unknown> = {}) {
    return buildRuleGenerationSpec({jobId: "job-1", taskId: "task-1", workspacePath: "/tmp/ws", ...overrides});
}

describe("buildRuleGenerationSpec", () => {
    it("focus로 모드를 정하고 모드에 맞는 기본 상한을 고른다", () => {
        const manual = specFor();
        const recent = specFor({focus: RULE_GENERATION_FOCUS.recent});

        expect(manual.mode).toBe(RULEGEN_MODE.manual);
        expect(manual.maxRules).toBe(5);
        expect(recent.mode).toBe(RULEGEN_MODE.recent);
        expect(recent.maxRules).toBe(2);
    });

    it("상한과 모델을 명시하면 그 값을 쓴다", () => {
        const spec = specFor({maxRules: 2, model: "claude-opus-4-6"});

        expect(spec.maxRules).toBe(2);
        expect(spec.model).toBe("claude-opus-4-6");
    });

    it("실행 상수 기본값을 채운다", () => {
        const spec = specFor();

        expect(spec.model).toBe(DEFAULT_RULEGEN_MODEL);
        expect(spec.fallbackModel).toBe(RULEGEN_FALLBACK_MODEL);
        expect(spec.maxBudgetUsd).toBe(DEFAULT_RULEGEN_BUDGET_USD);
        expect(spec.maxTurns).toBe(RULEGEN_MAX_TURNS);
        expect(spec.maxOutputTokens).toBe(RULEGEN_MAX_OUTPUT_TOKENS);
        expect(spec.effort).toBe(RULEGEN_EFFORT);
        expect(spec.deadlineMs).toBe(DEFAULT_RULEGEN_DEADLINE_MS);
    });

    it("시스템 프롬프트는 모드와 앵커·의도 지침을 얹은 프롬프트 조립을 그대로 싣는다", () => {
        const spec = specFor({focus: RULE_GENERATION_FOCUS.recent, anchorText: "테스트 돌려", intent: "린트 확인"});

        expect(spec.systemPrompt).toBe(buildRulegenSystemPrompt({
            mode: RULEGEN_MODE.recent,
            maxRules: 2,
            maxTurns: RULEGEN_MAX_TURNS,
            language: DEFAULT_RULEGEN_LANGUAGE,
            anchorDirective: buildAnchorDirective("테스트 돌려"),
            intentDirective: buildIntentDirective("린트 확인"),
            tools: RULEGEN_TOOL_SPECS,
        }));
    });

    it("사용자 프롬프트는 앵커와 의도 블록을 얹은 프롬프트 조립을 그대로 싣는다", () => {
        const spec = specFor({anchorText: "테스트 돌려", intent: "린트 확인"});

        expect(spec.userPrompt).toBe(buildRulegenUserPrompt({
            taskId: "task-1",
            workspacePath: "/tmp/ws",
            maxRules: 5,
            anchorBlock: buildAnchorBlock("테스트 돌려"),
            intentBlock: buildIntentBlock("린트 확인"),
        }));
    });

    it("근거 도구 명세와 출력 스키마를 실행기에 그대로 넘긴다", () => {
        const spec = specFor();

        expect(spec.tools).toEqual(RULEGEN_TOOL_SPECS);
        expect(spec.outputSchema).toEqual(buildRuleOutputSchema());
    });
});
