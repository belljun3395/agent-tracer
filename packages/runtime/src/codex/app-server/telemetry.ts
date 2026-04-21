/**
 * Codex App-Server Telemetry Builder
 *
 * Builds Agent Tracer contextSnapshot events and human-readable status text
 * from Codex token-usage and rate-limit data.
 *
 * Token usage is sourced from:
 *   - Rollout JSONL: event_msg → info field (cumulative and per-turn breakdown)
 *   - App-server notification: thread/tokenUsage/updated → tokenUsage field
 *
 * Rate limits are sourced from:
 *   - Rollout JSONL: event_msg → rate_limits field
 *   - App-server notification: account/rateLimits/updated → rateLimits field
 *
 * Rate-limit windows are represented as windowDurationMins. Well-known values
 * (300 min = 5 h, 10 080 min = 7 d) are also written to legacy metadata fields
 * for backward compatibility with monitor versions that expect named fields.
 *
 * contextWindowUsedPct is derived from last.totalTokens / modelContextWindow * 100,
 * computed only when modelContextWindow is a positive finite number.
 */
import type {RuntimeIngestEvent} from "~shared/events/kinds.js";
import {KIND} from "~shared/events/kinds.js";
import type {ContextSnapshotMetadata} from "~shared/events/metadata.js";
import {LANE} from "~shared/events/lanes.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import type {
    CodexAppServerRateLimitSnapshot,
    CodexAppServerRateLimitWindow,
    CodexAppServerThreadTokenUsage,
} from "./protocol.type.js";

export interface CodexContextSnapshotInput {
    readonly taskId: string;
    readonly sessionId: string;
    readonly threadId?: string;
    readonly turnId?: string;
    readonly modelId?: string;
    readonly modelProvider?: string;
    readonly tokenUsage?: CodexAppServerThreadTokenUsage;
    readonly rateLimits?: CodexAppServerRateLimitSnapshot;
}

interface StatusTextInput {
    readonly tokenUsage?: CodexAppServerThreadTokenUsage;
    readonly rateLimits?: CodexAppServerRateLimitSnapshot;
}

const ROLLOUT_SOURCE = "codex-rollout";

/**
 * Builds a contextSnapshot RuntimeIngestEvent from the current observer state.
 * The event title includes the context window utilization percentage when available.
 */
export function buildCodexContextSnapshotEvent(
    input: CodexContextSnapshotInput,
): RuntimeIngestEvent {
    const metadata: ContextSnapshotMetadata = {
        ...provenEvidence("Captured by the Codex rollout observer."),
        source: ROLLOUT_SOURCE,
        ...(input.threadId ? { threadId: input.threadId } : {}),
        ...(input.turnId ? { turnId: input.turnId } : {}),
        ...(input.modelId ? { modelId: input.modelId } : {}),
        ...(input.modelProvider ? { modelProvider: input.modelProvider } : {}),
        ...buildTokenUsageMetadata(input.tokenUsage),
        ...buildRateLimitMetadata(input.rateLimits),
    };

    const usedPct = typeof metadata.contextWindowUsedPct === "number"
        ? metadata.contextWindowUsedPct
        : null;

    return {
        kind: KIND.contextSnapshot,
        taskId: input.taskId,
        sessionId: input.sessionId,
        title: usedPct !== null
            ? `Context ${Math.round(usedPct)}% used`
            : "Codex status snapshot",
        lane: LANE.telemetry,
        metadata,
    };
}

/**
 * Formats a short human-readable status string for stdout (e.g. "[monitor] ctx 42% · 5h 18%").
 * Returns an empty string when no data is available to display.
 * Used by the observer when --quiet is not set.
 */
export function formatCodexStatusText(input: StatusTextInput): string {
    const parts: string[] = [];
    const ctxPct = getContextUsedPct(input.tokenUsage);
    if (ctxPct !== null) {
        parts.push(`ctx ${Math.round(ctxPct)}%`);
    }

    const primary = input.rateLimits?.primary ?? null;
    if (primary?.usedPercent !== undefined) {
        const label = formatWindowLabel(primary.windowDurationMins);
        parts.push(`${label} ${Math.round(primary.usedPercent)}%`);
    }

    return parts.length > 0 ? `[monitor] ${parts.join(" · ")}` : "";
}

function buildTokenUsageMetadata(
    tokenUsage: CodexAppServerThreadTokenUsage | undefined,
): Partial<ContextSnapshotMetadata> {
    if (!tokenUsage) return {};

    const contextUsage = tokenUsage.last;
    const contextWindowUsedPct = getContextUsedPct(tokenUsage);
    const contextWindowRemainingPct = contextWindowUsedPct !== null
        ? roundPct(100 - contextWindowUsedPct)
        : undefined;

    return {
        ...(contextWindowUsedPct !== null ? { contextWindowUsedPct } : {}),
        ...(contextWindowRemainingPct !== undefined ? { contextWindowRemainingPct } : {}),
        contextWindowTotalTokens: contextUsage.totalTokens,
        ...(tokenUsage.modelContextWindow !== null ? { contextWindowSize: tokenUsage.modelContextWindow } : {}),
        contextWindowInputTokens: contextUsage.inputTokens,
        contextWindowOutputTokens: contextUsage.outputTokens,
        contextWindowCacheReadTokens: contextUsage.cachedInputTokens,
        reasoningOutputTokens: contextUsage.reasoningOutputTokens,
        lastTurnInputTokens: tokenUsage.last.inputTokens,
        lastTurnOutputTokens: tokenUsage.last.outputTokens,
        lastTurnCachedInputTokens: tokenUsage.last.cachedInputTokens,
        lastTurnReasoningOutputTokens: tokenUsage.last.reasoningOutputTokens,
    };
}

function buildRateLimitMetadata(
    rateLimits: CodexAppServerRateLimitSnapshot | undefined,
): Partial<ContextSnapshotMetadata> {
    if (!rateLimits) return {};

    const primary = rateLimits.primary;
    const secondary = rateLimits.secondary;

    return {
        ...(primary?.usedPercent !== undefined ? { rateLimitPrimaryUsedPct: primary.usedPercent } : {}),
        ...(primary?.windowDurationMins !== null && primary?.windowDurationMins !== undefined
            ? { rateLimitPrimaryWindowDurationMins: primary.windowDurationMins }
            : {}),
        ...(primary?.resetsAt !== null && primary?.resetsAt !== undefined
            ? { rateLimitPrimaryResetsAt: primary.resetsAt }
            : {}),
        ...(secondary?.usedPercent !== undefined ? { rateLimitSecondaryUsedPct: secondary.usedPercent } : {}),
        ...(secondary?.windowDurationMins !== null && secondary?.windowDurationMins !== undefined
            ? { rateLimitSecondaryWindowDurationMins: secondary.windowDurationMins }
            : {}),
        ...(secondary?.resetsAt !== null && secondary?.resetsAt !== undefined
            ? { rateLimitSecondaryResetsAt: secondary.resetsAt }
            : {}),
        ...mapLegacyRateLimitMetadata(primary, secondary),
    };
}

function mapLegacyRateLimitMetadata(
    primary: CodexAppServerRateLimitWindow | null | undefined,
    secondary: CodexAppServerRateLimitWindow | null | undefined,
): Partial<ContextSnapshotMetadata> {
    const legacy: Partial<ContextSnapshotMetadata> = {};

    for (const window of [primary, secondary]) {
        if (!window || window.windowDurationMins == null) continue;
        if (window.windowDurationMins === 300) {
            Object.assign(legacy, {
                rateLimitFiveHourUsedPct: window.usedPercent,
                ...(window.resetsAt != null ? { rateLimitFiveHourResetsAt: window.resetsAt } : {}),
            });
        }
        if (window.windowDurationMins === 10080) {
            Object.assign(legacy, {
                rateLimitSevenDayUsedPct: window.usedPercent,
                ...(window.resetsAt != null ? { rateLimitSevenDayResetsAt: window.resetsAt } : {}),
            });
        }
    }

    return legacy;
}

function getContextUsedPct(tokenUsage: CodexAppServerThreadTokenUsage | undefined): number | null {
    if (!tokenUsage || tokenUsage.modelContextWindow == null || tokenUsage.modelContextWindow <= 0) {
        return null;
    }
    return roundPct((tokenUsage.last.totalTokens / tokenUsage.modelContextWindow) * 100);
}

function roundPct(value: number): number {
    return Math.round(value * 100) / 100;
}

/**
 * Converts a windowDurationMins value into a display label (e.g. 60→"1h", 1440→"1d", 10→"10m").
 * Returns "quota" when the value is null, undefined, or non-positive.
 */
export function formatWindowLabel(windowDurationMins: number | null | undefined): string {
    if (windowDurationMins == null || windowDurationMins <= 0) return "quota";
    if (windowDurationMins < 60) return `${windowDurationMins}m`;
    if (windowDurationMins % 1440 === 0) {
        const days = windowDurationMins / 1440;
        return `${days}d`;
    }
    if (windowDurationMins % 60 === 0) {
        const hours = windowDurationMins / 60;
        return `${hours}h`;
    }
    const hours = Math.floor(windowDurationMins / 60);
    const minutes = windowDurationMins % 60;
    return `${hours}h${minutes}m`;
}
