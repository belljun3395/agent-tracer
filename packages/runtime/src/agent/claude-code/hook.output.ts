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
    readonly titleNudge: string;
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
        input.titleNudge,
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

/** 데몬이 답한 배출 상태이며 데몬이 없으면 null이다. */
export interface DeliveryStatus {
    readonly reachable: boolean;
    readonly baseUrl: string;
    readonly backlogBytes: number;
}

/** 서버에 닿지 못해도 훅은 조용히 성공하므로 사용자가 눈치채려면 이 문장뿐이다. */
export function formatDeliveryWarning(delivery: DeliveryStatus | null): string {
    if (delivery === null || delivery.reachable) return "";
    return [
        `agent-tracer: ${delivery.baseUrl}에 닿지 못한다.`,
        `이벤트가 로컬 스풀에만 쌓인다(${formatBytes(delivery.backlogBytes)}).`,
        "서버를 띄우거나 MONITOR_BASE_URL로 서버를 가리켜라.",
    ].join(" ");
}

/** systemMessage는 모델이 아니라 사용자에게 보이는 줄이다. */
export function emitDeliveryWarning(delivery: DeliveryStatus | null): boolean {
    const systemMessage = formatDeliveryWarning(delivery);
    if (systemMessage === "") return false;
    writeStdout({systemMessage});
    return true;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function writeStdout(value: unknown): void {
    process.stdout.write(`${JSON.stringify(value)}\n`);
}
