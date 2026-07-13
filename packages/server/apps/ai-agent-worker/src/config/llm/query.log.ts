import type { GenAiProvider } from "@monitor/kernel";
import type { AgentQueryResult } from "./llm.runner.js";

/** 언어 모델 호출 결과를 한 줄로 기록한다. */
export function logAgentQuery(
    label: string,
    provider: GenAiProvider,
    model: string,
    result: AgentQueryResult,
): void {
    const usage = result.usage;
    const tokens = usage
        ? `in=${usage.inputTokens} out=${usage.outputTokens} cacheR=${usage.cacheReadTokens} cacheW=${usage.cacheCreationTokens}`
        : "tokens=n/a";
    const cost = result.costUsd !== null ? `$${result.costUsd.toFixed(4)}` : "n/a";
    const turns = result.numTurns !== null ? String(result.numTurns) : "?";
    const status = result.errorSubtype !== null ? `error=${result.errorSubtype}` : "ok";
    process.stdout.write(
        `[agent-query] ${label} provider=${provider} model=${model} ${status} turns=${turns} cost=${cost} ${tokens} ms=${result.durationMs}\n`,
    );
}
