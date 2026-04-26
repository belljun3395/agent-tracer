/**
 * Claude Code Status Line Script
 *
 * Configured in .claude/settings.json as:
 *   "statusLine": "${CLAUDE_PLUGIN_ROOT}/bin/run-hook.sh StatusLine"
 *
 * Claude Code sends a JSON payload on stdin after every API request and on
 * session start. This script:
 *   1. Posts a context.snapshot event to the monitor (session_id, context_window,
 *      rate_limits, cost, model).
 *   2. Writes a compact status string to stdout for display in the Claude Code
 *      status bar.
 *
 * Stdout format: plain text, max ~60 chars. ANSI codes are supported but we
 * keep it simple — Claude Code renders the first line only.
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/statusline.md):
 *   session_id              string
 *   version                 string
 *   model.id                string
 *   model.display_name      string
 *   context_window.used_percentage       number | null
 *   context_window.remaining_percentage  number | null
 *   context_window.total_input_tokens    number
 *   context_window.total_output_tokens   number
 *   context_window.context_window_size   number
 *   context_window.current_usage         object | null  — latest API call token breakdown
 *   cost.total_cost_usd     number
 *   rate_limits             object | undefined  — Pro/Max only
 *     .five_hour.used_percentage   number
 *     .five_hour.resets_at         number  (unix seconds)
 *     .seven_day.used_percentage   number
 *     .seven_day.resets_at         number
 */
import { readStdinJson, ensureRuntimeSession, postTaggedEvent } from "~claude-code/hooks/lib/transport/transport.js";
import { KIND } from "~shared/events/kinds.js";
import type { ContextSnapshotMetadata } from "~shared/events/metadata.js";
import { provenEvidence } from "~shared/semantics/evidence.js";
import { hookLog } from "~claude-code/hooks/lib/hook/hook.log.js";
import { LANE } from "~shared/events/lanes.js";
import { formatStatusText, type StatusLinePayload } from "./StatusLine.format.js";

async function main(): Promise<void> {
    const payload = await readStdinJson() as StatusLinePayload;

    const sessionId = payload.session_id;

    // Always write status text to stdout — even if we skip the monitor POST.
    const statusText = formatStatusText(payload);
    if (statusText) {
        process.stdout.write(statusText + "\n");
    }

    if (!sessionId) {
        hookLog("StatusLine", "skipped — no session_id");
        return;
    }

    const ctx = payload.context_window;
    const rl = payload.rate_limits;

    // Skip posting if there's no meaningful data yet (before first API call).
    if (ctx?.used_percentage == null && rl == null) {
        hookLog("StatusLine", "skipped — no context or rate limit data yet");
        return;
    }

    let taskId: string;
    let monitorSessionId: string;
    try {
        const result = await ensureRuntimeSession(sessionId, undefined, { resume: false });
        taskId = result.taskId;
        monitorSessionId = result.sessionId;
    } catch (err) {
        hookLog("StatusLine", "ensureRuntimeSession failed", { error: String(err) });
        return;
    }

    const usedPct = ctx?.used_percentage ?? undefined;
    const title = usedPct != null
        ? `Context ${Math.round(usedPct)}% used`
        : "Context snapshot";

    const metadata: ContextSnapshotMetadata = {
        ...provenEvidence("Captured by the Claude Code status line script."),
        ...(ctx?.used_percentage != null ? { contextWindowUsedPct: ctx.used_percentage } : {}),
        ...(ctx?.remaining_percentage != null ? { contextWindowRemainingPct: ctx.remaining_percentage } : {}),
        ...(ctx?.total_input_tokens != null ? { contextWindowTotalTokens: ctx.total_input_tokens + (ctx.total_output_tokens ?? 0) } : {}),
        ...(ctx?.context_window_size != null ? { contextWindowSize: ctx.context_window_size } : {}),
        ...(ctx?.current_usage?.input_tokens != null ? { contextWindowInputTokens: ctx.current_usage.input_tokens } : {}),
        ...(ctx?.current_usage?.output_tokens != null ? { contextWindowOutputTokens: ctx.current_usage.output_tokens } : {}),
        ...(ctx?.current_usage?.cache_creation_input_tokens != null ? { contextWindowCacheCreationTokens: ctx.current_usage.cache_creation_input_tokens } : {}),
        ...(ctx?.current_usage?.cache_read_input_tokens != null ? { contextWindowCacheReadTokens: ctx.current_usage.cache_read_input_tokens } : {}),
        ...(rl?.five_hour?.used_percentage != null ? { rateLimitFiveHourUsedPct: rl.five_hour.used_percentage } : {}),
        ...(rl?.five_hour?.resets_at != null ? { rateLimitFiveHourResetsAt: rl.five_hour.resets_at } : {}),
        ...(rl?.seven_day?.used_percentage != null ? { rateLimitSevenDayUsedPct: rl.seven_day.used_percentage } : {}),
        ...(rl?.seven_day?.resets_at != null ? { rateLimitSevenDayResetsAt: rl.seven_day.resets_at } : {}),
        ...(payload.cost?.total_cost_usd != null ? { costTotalUsd: payload.cost.total_cost_usd } : {}),
        ...(payload.model?.id != null ? { modelId: payload.model.id } : {}),
        ...(payload.version != null ? { sessionVersion: payload.version } : {}),
    };

    await postTaggedEvent({
        kind: KIND.contextSnapshot,
        taskId,
        sessionId: monitorSessionId,
        lane: LANE.telemetry,
        title,
        metadata,
    });

    hookLog("StatusLine", "context.snapshot posted", {
        usedPct,
        fiveHourPct: rl?.five_hour?.used_percentage,
    });
}

void main().catch((err: unknown) => {
    hookLog("StatusLine", "ERROR", { error: String(err) });
});
