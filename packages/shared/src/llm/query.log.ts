import { Logger } from "@nestjs/common";
import type { AgentQueryResult } from "./query.runner.port.js";

const logger = new Logger("AgentQuery");

/**
 * Emit one structured line summarizing a completed agent query. The cost / token /
 * turn metrics the runner captures from the SDK result message would otherwise
 * dead-end here; logging them is the lightweight surface for an observability
 * product to see what its own agents cost. (costUsd is "n/a" for the Messages
 * API runner, which doesn't report a cost.)
 */
export function logAgentQuery(label: string, model: string, result: AgentQueryResult): void {
    const u = result.usage;
    const tokens = u
        ? `in=${u.inputTokens} out=${u.outputTokens} cacheR=${u.cacheReadTokens} cacheW=${u.cacheCreationTokens}`
        : "tokens=n/a";
    const cost = result.costUsd !== null ? `$${result.costUsd.toFixed(4)}` : "n/a";
    const turns = result.numTurns !== null ? result.numTurns : "?";
    const status = result.errorSubtype !== null ? `error=${result.errorSubtype}` : "ok";
    logger.log(
        `${label} model=${model} ${status} turns=${turns} cost=${cost} ${tokens} ms=${result.durationMs}`,
    );
}
