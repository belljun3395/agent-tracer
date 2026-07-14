import type {RuleGenerationFocus} from "@monitor/kernel/job/job.const.js";
import {buildAnchorBlock, buildAnchorDirective} from "~runtime/domain/rulegen/model/anchor.model.js";
import {DEFAULT_RULEGEN_DEADLINE_MS} from "~runtime/domain/rulegen/model/deadline.model.js";
import {buildIntentBlock, buildIntentDirective} from "~runtime/domain/rulegen/model/intent.model.js";
import {buildRuleOutputSchema} from "~runtime/domain/rulegen/model/output.schema.model.js";
import {defaultMaxRules, resolveRulegenMode, type RulegenMode} from "~runtime/domain/rulegen/model/rulegen.mode.model.js";
import {
    buildRulegenSystemPrompt,
    buildRulegenUserPrompt,
} from "~runtime/domain/rulegen/model/rulegen.prompt.model.js";
import {RULEGEN_TOOL_SPECS, type RulegenToolSpec} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";

export const DEFAULT_RULEGEN_MODEL = "claude-sonnet-4-6";
export const RULEGEN_FALLBACK_MODEL = "claude-haiku-4-5";
export const DEFAULT_RULEGEN_BUDGET_USD = 2;
export const RULEGEN_MAX_TURNS = 15;
export const RULEGEN_MAX_OUTPUT_TOKENS = 8_000;
export const DEFAULT_RULEGEN_LANGUAGE = "auto";

/** 모델이 답 하나에 들이는 추론의 양이다. */
export type RulegenEffort = "low" | "medium" | "high" | "xhigh" | "max";

export const RULEGEN_EFFORT: RulegenEffort = "medium";

/** 잡 하나를 규칙 생성 실행에 넘기는 입력이다. */
export interface RuleGenerationRequest {
    readonly jobId: string;
    readonly taskId: string;
    readonly workspacePath: string;
    readonly focus?: RuleGenerationFocus;
    readonly maxRules?: number;
    readonly intent?: string;
    readonly anchorText?: string;
    readonly language?: string;
    readonly model?: string;
}

/** 실행기가 그대로 집행하는 규칙 생성 명세이며 제품 규칙은 전부 여기에 담긴다. */
export interface RuleGenerationSpec {
    readonly jobId: string;
    readonly taskId: string;
    readonly workspacePath: string;
    readonly mode: RulegenMode;
    readonly model: string;
    readonly fallbackModel: string;
    readonly maxRules: number;
    readonly maxTurns: number;
    readonly maxBudgetUsd: number;
    readonly maxOutputTokens: number;
    readonly effort: RulegenEffort;
    readonly deadlineMs: number;
    readonly systemPrompt: string;
    readonly userPrompt: string;
    readonly outputSchema: Record<string, unknown>;
    readonly tools: readonly RulegenToolSpec[];
}

export function buildRuleGenerationSpec(request: RuleGenerationRequest): RuleGenerationSpec {
    const mode = resolveRulegenMode(request.focus);
    const maxRules = request.maxRules ?? defaultMaxRules(mode);
    const language = request.language ?? DEFAULT_RULEGEN_LANGUAGE;
    const anchorDirective = buildAnchorDirective(request.anchorText);
    const intentDirective = buildIntentDirective(request.intent);
    return {
        jobId: request.jobId,
        taskId: request.taskId,
        workspacePath: request.workspacePath,
        mode,
        model: request.model ?? DEFAULT_RULEGEN_MODEL,
        fallbackModel: RULEGEN_FALLBACK_MODEL,
        maxRules,
        maxTurns: RULEGEN_MAX_TURNS,
        maxBudgetUsd: DEFAULT_RULEGEN_BUDGET_USD,
        maxOutputTokens: RULEGEN_MAX_OUTPUT_TOKENS,
        effort: RULEGEN_EFFORT,
        deadlineMs: DEFAULT_RULEGEN_DEADLINE_MS,
        systemPrompt: buildRulegenSystemPrompt({
            mode,
            maxRules,
            maxTurns: RULEGEN_MAX_TURNS,
            language,
            anchorDirective,
            intentDirective,
            tools: RULEGEN_TOOL_SPECS,
        }),
        userPrompt: buildRulegenUserPrompt({
            taskId: request.taskId,
            workspacePath: request.workspacePath,
            maxRules,
            anchorBlock: buildAnchorBlock(request.anchorText),
            intentBlock: buildIntentBlock(request.intent),
        }),
        outputSchema: buildRuleOutputSchema(),
        tools: RULEGEN_TOOL_SPECS,
    };
}
