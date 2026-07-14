import {formatBlockReason} from "~runtime/domain/guardrail/model/enforce.model.js";
import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import {formatRulesContext} from "~runtime/domain/guardrail/model/rules.context.model.js";
import type {GuardrailVerdict} from "~runtime/domain/guardrail/model/verdict.model.js";
import {formatHintsContext} from "~runtime/domain/hint/model/hint.model.js";
import type {PreprocessingHint} from "~runtime/domain/hint/model/hint.model.js";

/** Claude Code가 훅 한 번에 additionalContext를 하나만 받으므로 규칙과 힌트와 레시피를 한 블록으로 합친다. */
export type ContextHookName = "UserPromptSubmit" | "PreToolUse";

export interface AgentContextInput {
    readonly rules: readonly GuardrailRule[];
    readonly hints: readonly PreprocessingHint[];
    readonly recipeContext: string;
}

export interface AgentContextEmission {
    readonly emitted: boolean;
    readonly recipeBytes: number;
}

export function emitAgentContext(
    hookEventName: ContextHookName,
    input: AgentContextInput,
): AgentContextEmission {
    const sections = [
        formatRulesContext(input.rules),
        formatHintsContext(input.hints),
        input.recipeContext,
    ].filter((section) => section !== "");
    if (sections.length === 0) return {emitted: false, recipeBytes: 0};

    writeStdout({hookSpecificOutput: {hookEventName, additionalContext: sections.join("\n")}});
    return {emitted: true, recipeBytes: Buffer.byteLength(input.recipeContext, "utf8")};
}

/** 힌트만 있는 훅에서 다음 턴 앞에 붙일 컨텍스트를 낸다. */
export function emitHints(hookEventName: ContextHookName, hints: readonly PreprocessingHint[]): boolean {
    const additionalContext = formatHintsContext(hints);
    if (additionalContext === "") return false;
    writeStdout({hookSpecificOutput: {hookEventName, additionalContext}});
    return true;
}

/** stdout JSON의 block 결정은 다중 플러그인 환경에서 무시되는 사례가 있어 exit code 계약을 쓴다. */
export function blockTurn(verdicts: readonly GuardrailVerdict[]): void {
    process.stderr.write(`${formatBlockReason(verdicts)}\n`);
    process.exitCode = 2;
}

function writeStdout(value: unknown): void {
    process.stdout.write(`${JSON.stringify(value)}\n`);
}
