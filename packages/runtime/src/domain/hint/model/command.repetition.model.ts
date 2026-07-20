import {isTerminalCommand} from "@monitor/kernel/ingest/event.kind.const.js";
import {AGENT_TRACER_ATTR} from "@monitor/kernel/observability/semconv.const.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";
import type {PreprocessingHint} from "~runtime/domain/hint/model/hint.model.js";

const COMMAND_LOOKBACK = 20;
const REPETITION_THRESHOLD = 3;
const RECENT_WINDOW_MS = 10 * 60 * 1000;

/** 글자까지 같은 명령을 되풀이하면 알린다. */
export function detectCommandRepetition(
    recent: readonly RecentEvent[],
    command: string,
    now: number,
): PreprocessingHint[] {
    const normalized = command.trim();
    if (!normalized) return [];

    const prior = recent.filter((event) => isTerminalCommand(event)).slice(-COMMAND_LOOKBACK);
    let sameCommand = 0;

    for (const event of prior) {
        const ageMs = now - Date.parse(event.occurredAt);
        if (!Number.isFinite(ageMs) || ageMs > RECENT_WINDOW_MS) continue;

        const priorCommand = event.metadata[AGENT_TRACER_ATTR.command];
        if (typeof priorCommand === "string" && priorCommand.trim() === normalized) sameCommand += 1;
    }

    if (sameCommand < REPETITION_THRESHOLD) return [];
    return [{
        type: "command_repetition",
        severity: "warning",
        title: "Identical command repeated",
        message: `You've run this exact command ${sameCommand} times in the last 10 min, so check the prior output before retrying.`,
    }];
}
