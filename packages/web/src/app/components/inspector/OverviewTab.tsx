import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { formatCount } from "~app/lib/formatters.js";
import { buildSubagentInsight } from "~app/lib/insights/aggregation.js";
import { buildInspectorEventTitle } from "~app/lib/insights/extraction.js";
import { buildQuestionGroups, buildTodoGroups, buildVerificationCycles } from "~app/lib/insights/grouping.js";
import type { ModelSummary, QuestionGroup, TodoGroup, VerificationCycleItem } from "~app/lib/insights/grouping.js";
import type { SubagentInsight } from "~app/lib/insights/types.js";
import { buildResumeCommand } from "~app/lib/resume-command.js";
import { formatRelativeTime } from "~app/lib/timeline.js";
import type { TimelineEventRecord } from "~domain/monitoring.js";
import { segmentEventsByTurn } from "~domain/segments.js";
import { filterEventsByGroup, scopeLabelForGroup } from "~domain/turn-partition.js";
import type { TurnGroup, TurnPartition } from "~domain/turn-partition.js";
import { countCompactions } from "~app/lib/insights/helpers.js";
import { summarizeSkillListing } from "~app/lib/insights/skillListing.js";
import { normalizeContextWarningThreshold } from "~app/lib/contextWarningPrefs.js";
import { useContextWarningPrefs } from "~app/lib/useContextWarningPrefs.js";
import { copyToClipboard } from "~app/lib/ui/clipboard.js";
import { cn } from "~app/lib/ui/cn.js";
import { Badge } from "../ui/Badge.js";
import { Eyebrow } from "../ui/Eyebrow.js";
import { HelpTooltip } from "../ui/HelpTooltip.js";
import { PanelCard } from "../ui/PanelCard.js";
import { SectionCard } from "./SectionCard.js";
import { cardShell, cardHeader, cardBody, innerPanel } from "./styles.js";
import { inspectorHelpText } from "./helpText.js";


function truncate(value: string, limit: number): string {
    if (value.length <= limit) return value;
    return `${value.slice(0, limit - 1).trimEnd()}…`;
}

function UsageBar({ pct, color }: { readonly pct: number; readonly color: string }): React.JSX.Element {
    const clamped = Math.max(0, Math.min(100, pct));
    const warn = clamped >= 80;
    const critical = clamped >= 95;
    const barColor = critical ? "var(--err)" : warn ? "var(--warn)" : color;
    return (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
            <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${clamped}%`, background: barColor }}
            />
        </div>
    );
}

function formatResetsAt(unixSeconds: number): string {
    const diff = unixSeconds * 1000 - Date.now();
    if (diff <= 0) return "reset soon";
    const totalMin = Math.round(diff / 60_000);
    if (totalMin < 60) return `resets in ${totalMin}m`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `resets in ${h}h${m > 0 ? ` ${m}m` : ""}`;
}

function formatWindowLabel(windowDurationMins: number | null): string {
    if (windowDurationMins == null || windowDurationMins <= 0) return "quota";
    if (windowDurationMins < 60) return `${windowDurationMins}m`;
    if (windowDurationMins % 1440 === 0) return `${windowDurationMins / 1440}d`;
    if (windowDurationMins % 60 === 0) return `${windowDurationMins / 60}h`;
    const hours = Math.floor(windowDurationMins / 60);
    const minutes = windowDurationMins % 60;
    return `${hours}h${minutes}m`;
}

function ContextSnapshotCard({ timeline }: { readonly timeline: readonly TimelineEventRecord[] }): React.JSX.Element | null {
    const { prefs, setEnabled, setThresholdPct } = useContextWarningPrefs();
    const [thresholdInput, setThresholdInput] = useState(() => String(prefs.thresholdPct));
    const latest = useMemo(() => {
        let found: TimelineEventRecord | null = null;
        for (const e of timeline) {
            if (e.kind !== "context.snapshot") continue;
            if (!found || Date.parse(e.createdAt) > Date.parse(found.createdAt)) found = e;
        }
        return found;
    }, [timeline]);

    useEffect(() => {
        setThresholdInput(String(prefs.thresholdPct));
    }, [prefs.thresholdPct]);

    if (!latest) return null;

    const md = latest.metadata;
    const usedPct = typeof md["contextWindowUsedPct"] === "number" ? md["contextWindowUsedPct"] : null;
    const windowSize = typeof md["contextWindowSize"] === "number" ? md["contextWindowSize"] : null;
    const totalTokens = typeof md["contextWindowTotalTokens"] === "number" ? md["contextWindowTotalTokens"] : null;
    const costUsd = typeof md["costTotalUsd"] === "number" ? md["costTotalUsd"] : null;
    const fiveHourPct = typeof md["rateLimitFiveHourUsedPct"] === "number" ? md["rateLimitFiveHourUsedPct"] : null;
    const fiveHourResets = typeof md["rateLimitFiveHourResetsAt"] === "number" ? md["rateLimitFiveHourResetsAt"] : null;
    const sevenDayPct = typeof md["rateLimitSevenDayUsedPct"] === "number" ? md["rateLimitSevenDayUsedPct"] : null;
    const sevenDayResets = typeof md["rateLimitSevenDayResetsAt"] === "number" ? md["rateLimitSevenDayResetsAt"] : null;
    const primaryPct = typeof md["rateLimitPrimaryUsedPct"] === "number" ? md["rateLimitPrimaryUsedPct"] : null;
    const primaryWindow = typeof md["rateLimitPrimaryWindowDurationMins"] === "number"
        ? md["rateLimitPrimaryWindowDurationMins"]
        : null;
    const primaryResets = typeof md["rateLimitPrimaryResetsAt"] === "number" ? md["rateLimitPrimaryResetsAt"] : null;
    const secondaryPct = typeof md["rateLimitSecondaryUsedPct"] === "number" ? md["rateLimitSecondaryUsedPct"] : null;
    const secondaryWindow = typeof md["rateLimitSecondaryWindowDurationMins"] === "number"
        ? md["rateLimitSecondaryWindowDurationMins"]
        : null;
    const secondaryResets = typeof md["rateLimitSecondaryResetsAt"] === "number" ? md["rateLimitSecondaryResetsAt"] : null;
    const modelId = typeof md["modelId"] === "string" ? md["modelId"] : null;

    const primaryLabel = fiveHourPct !== null ? "5-hour" : primaryPct !== null ? formatWindowLabel(primaryWindow) : null;
    const primaryUsage = fiveHourPct ?? primaryPct;
    const primaryReset = fiveHourResets ?? primaryResets;
    const secondaryLabel = sevenDayPct !== null ? "7-day" : secondaryPct !== null ? formatWindowLabel(secondaryWindow) : null;
    const secondaryUsage = sevenDayPct ?? secondaryPct;
    const secondaryReset = sevenDayResets ?? secondaryResets;

    const hasCtx = usedPct !== null;
    const hasRl = primaryUsage !== null || secondaryUsage !== null;

    if (!hasCtx && !hasRl) return null;

    const commitThresholdInput = (): void => {
        if (thresholdInput.trim() === "") {
            setThresholdInput(String(prefs.thresholdPct));
            return;
        }
        const parsed = Number(thresholdInput);
        const normalized = normalizeContextWarningThreshold(parsed);
        setThresholdPct(normalized);
        setThresholdInput(String(normalized));
    };

    return (
        <PanelCard className={cardShell}>
            <div className={cardHeader}>
                <span>Context &amp; Rate Limits</span>
                {modelId && (
                    <span className="ml-auto font-mono text-[0.65rem] text-[var(--text-3)] font-normal">{modelId}</span>
                )}
            </div>
            <div className={cardBody}>
                {hasCtx && (
                    <div className={innerPanel + " p-3"}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <Eyebrow className="block">Context Window</Eyebrow>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <strong className="text-[1.1rem] text-[var(--accent)]">{Math.round(usedPct)}%</strong>
                                    <span className="text-[0.72rem] text-[var(--text-3)]">used</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <label className="flex items-center gap-2 text-[0.72rem] font-medium text-[var(--text-2)]">
                                    <input
                                        checked={prefs.enabled}
                                        onChange={(event) => setEnabled(event.target.checked)}
                                        type="checkbox"
                                    />
                                    <span>Alert</span>
                                </label>
                                <label className="flex items-center gap-2 text-[0.68rem] text-[var(--text-3)]">
                                    <span>Threshold</span>
                                    <input
                                        className="w-14 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-right text-[0.74rem] font-semibold text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
                                        disabled={!prefs.enabled}
                                        max={100}
                                        min={1}
                                        onBlur={commitThresholdInput}
                                        onChange={(event) => setThresholdInput(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                commitThresholdInput();
                                                event.currentTarget.blur();
                                            }
                                            if (event.key === "Escape") {
                                                setThresholdInput(String(prefs.thresholdPct));
                                                event.currentTarget.blur();
                                            }
                                        }}
                                        type="number"
                                        value={thresholdInput}
                                    />
                                    <span>%</span>
                                </label>
                            </div>
                        </div>
                        <UsageBar pct={usedPct} color="var(--accent)" />
                        <div className="mt-1.5 flex gap-3 text-[0.68rem] text-[var(--text-3)]">
                            {totalTokens !== null && (
                                <span>{totalTokens.toLocaleString()} tokens</span>
                            )}
                            {windowSize !== null && (
                                <span>/ {(windowSize / 1000).toFixed(0)}k limit</span>
                            )}
                            {costUsd !== null && costUsd > 0 && (
                                <span className="ml-auto">${costUsd.toFixed(3)}</span>
                            )}
                        </div>
                        <p className="mt-2 mb-0 text-[0.68rem] text-[var(--text-3)]">
                            {prefs.enabled
                                ? `Warn when usage reaches ${prefs.thresholdPct}%.`
                                : "Context usage alerts are off."}
                        </p>
                    </div>
                )}
                {hasRl && (
                    <div className={innerPanel + " p-3 mt-2"}>
                        <Eyebrow className="block">Rate Limits</Eyebrow>
                        {primaryUsage !== null && primaryLabel && (
                            <div className="mt-2">
                                <div className="flex items-baseline justify-between">
                                    <span className="text-[0.72rem] text-[var(--text-2)] font-medium">{primaryLabel}</span>
                                    <div className="flex items-baseline gap-1.5">
                                        <strong className="text-[0.9rem]" style={{
                                            color: primaryUsage >= 95 ? "var(--err)" : primaryUsage >= 80 ? "var(--warn)" : "var(--text-1)"
                                        }}>{Math.round(primaryUsage)}%</strong>
                                        {primaryReset !== null && (
                                            <span className="text-[0.65rem] text-[var(--text-3)]">{formatResetsAt(primaryReset)}</span>
                                        )}
                                    </div>
                                </div>
                                <UsageBar pct={primaryUsage} color="var(--warn)" />
                            </div>
                        )}
                        {secondaryUsage !== null && secondaryLabel && (
                            <div className="mt-2">
                                <div className="flex items-baseline justify-between">
                                    <span className="text-[0.72rem] text-[var(--text-2)] font-medium">{secondaryLabel}</span>
                                    <div className="flex items-baseline gap-1.5">
                                        <strong className="text-[0.9rem]" style={{
                                            color: secondaryUsage >= 95 ? "var(--err)" : secondaryUsage >= 80 ? "var(--warn)" : "var(--text-1)"
                                        }}>{Math.round(secondaryUsage)}%</strong>
                                        {secondaryReset !== null && (
                                            <span className="text-[0.65rem] text-[var(--text-3)]">{formatResetsAt(secondaryReset)}</span>
                                        )}
                                    </div>
                                </div>
                                <UsageBar pct={secondaryUsage} color="var(--coordination)" />
                            </div>
                        )}
                    </div>
                )}
                {!hasCtx && hasRl && (
                    <p className="mt-2 mb-0 text-[0.68rem] text-[var(--text-3)]">
                        Context usage is unavailable for this Codex snapshot. The current plain `codex` observer path is only receiving model and rate-limit telemetry.
                    </p>
                )}
                <p className="mt-1.5 mb-0 text-[0.65rem] text-[var(--text-3)]">
                    Snapshot from {formatRelativeTime(latest.createdAt)}
                </p>
            </div>
        </PanelCard>
    );
}

function metadataNumber(event: TimelineEventRecord, key: string): number | null {
    const value = event.metadata[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metadataString(event: TimelineEventRecord, key: string): string | null {
    const value = event.metadata[key];
    return typeof value === "string" && value.length > 0 ? value : null;
}

function TokenUsageCard({ timeline }: { readonly timeline: readonly TimelineEventRecord[] }): React.JSX.Element | null {
    const latest = useMemo(() => {
        let found: TimelineEventRecord | null = null;
        for (const event of timeline) {
            if (event.kind !== "token.usage") continue;
            if (!found || Date.parse(event.createdAt) > Date.parse(found.createdAt)) found = event;
        }
        return found;
    }, [timeline]);

    if (!latest) return null;

    const inputTokens = metadataNumber(latest, "inputTokens") ?? 0;
    const outputTokens = metadataNumber(latest, "outputTokens") ?? 0;
    const cacheReadTokens = metadataNumber(latest, "cacheReadTokens") ?? 0;
    const cacheCreateTokens = metadataNumber(latest, "cacheCreateTokens") ?? 0;
    const durationMs = metadataNumber(latest, "durationMs");
    const costUsd = metadataNumber(latest, "costUsd");
    const model = metadataString(latest, "model");
    const promptId = metadataString(latest, "promptId");
    const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheCreateTokens;

    if (totalTokens === 0 && costUsd === null && durationMs === null) return null;

    return (
        <PanelCard className={cardShell}>
            <div className={cardHeader}>
                <span>Token Usage</span>
                {model && <span className="ml-auto font-mono text-[0.65rem] font-normal text-[var(--text-3)]">{model}</span>}
            </div>
            <div className={cardBody}>
                <div className="grid grid-cols-4 gap-2 max-lg:grid-cols-2 max-sm:grid-cols-1">
                    <div className={innerPanel + " p-3"}>
                        <Eyebrow className="block">Input</Eyebrow>
                        <strong className="mt-2 block text-[1rem] text-[var(--text-1)]">{formatCount(inputTokens)}</strong>
                    </div>
                    <div className={innerPanel + " p-3"}>
                        <Eyebrow className="block">Output</Eyebrow>
                        <strong className="mt-2 block text-[1rem] text-[var(--text-1)]">{formatCount(outputTokens)}</strong>
                    </div>
                    <div className={innerPanel + " p-3"}>
                        <Eyebrow className="block">Cache</Eyebrow>
                        <strong className="mt-2 block text-[1rem] text-[var(--text-1)]">{formatCount(cacheReadTokens + cacheCreateTokens)}</strong>
                        <p className="mt-1 mb-0 text-[0.68rem] text-[var(--text-3)]">
                            read {formatCount(cacheReadTokens)} · create {formatCount(cacheCreateTokens)}
                        </p>
                    </div>
                    <div className={innerPanel + " p-3"}>
                        <Eyebrow className="block">Total</Eyebrow>
                        <strong className="mt-2 block text-[1rem] text-[var(--telemetry)]">{formatCount(totalTokens)}</strong>
                        <p className="mt-1 mb-0 text-[0.68rem] text-[var(--text-3)]">
                            {costUsd !== null ? `$${costUsd.toFixed(4)}` : "cost n/a"}
                            {durationMs !== null ? ` · ${Math.round(durationMs)}ms` : ""}
                        </p>
                    </div>
                </div>
                <p className="mt-1.5 mb-0 text-[0.65rem] text-[var(--text-3)]">
                    Usage from {formatRelativeTime(latest.createdAt)}
                    {promptId ? ` · prompt ${promptId}` : ""}
                </p>
            </div>
        </PanelCard>
    );
}

function RuntimeSessionCard({ runtimeSessionId, runtimeSource, timeline = [] }: {
    readonly runtimeSessionId?: string | undefined;
    readonly runtimeSource?: string | undefined;
    readonly timeline?: readonly TimelineEventRecord[];
}): React.JSX.Element | null {
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
    if (!runtimeSessionId) return null;
    const spec = buildResumeCommand(runtimeSource, runtimeSessionId);
    const compactions = countCompactions(timeline);
    const handleCopy = (text: string): void => {
        void copyToClipboard(text).then((copied) => {
            setCopyStatus(copied ? "copied" : "failed");
            window.setTimeout(() => setCopyStatus("idle"), 1600);
        });
    };
    return (<SectionCard title={<span>Runtime Session{spec ? ` · ${spec.label}` : ""}</span>} helpText={inspectorHelpText.runtimeSession} action={spec ? (<button type="button" onClick={() => handleCopy(spec.command)} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[0.72rem] font-medium text-[var(--text-2)] shadow-[var(--shadow-1)] transition-[background-color,border-color,color] duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]">
          {copyStatus === "idle" ? "Copy command" : copyStatus === "copied" ? "Copied" : "Copy failed"}
        </button>) : undefined}>
      <div className={innerPanel + " p-3"}>
        <Eyebrow className="block">Session ID</Eyebrow>
        <code className="mt-1 block break-all font-mono text-[0.8rem] text-[var(--text-1)]">{runtimeSessionId}</code>
        {compactions > 0 && (
          <p className="mt-1.5 mb-0 text-[0.68rem] text-[var(--warn)]">
            {compactions} context compact{compactions === 1 ? "" : "s"} — session ID updated after compact; previous segments no longer resumable from this ID
          </p>
        )}
      </div>
      {spec ? (<div className={innerPanel + " mt-2 p-3"}>
          <Eyebrow className="block">Resume command</Eyebrow>
          <code className="mt-1 block break-all font-mono text-[0.8rem] text-[var(--text-1)]">{spec.command}</code>
        </div>) : (<p className="m-0 text-[0.78rem] text-[var(--text-3)]">
          Unknown runtime source ({runtimeSource ?? "n/a"}) — copy the session ID and resume manually.
        </p>)}
    </SectionCard>);
}

function SubagentInsightCard({ insight }: {
    readonly insight: SubagentInsight;
}): React.JSX.Element {
    return (<PanelCard className={cardShell}>
      <div className={cardHeader}>
        <div className="flex items-start gap-2">
          <span>Subagents & Background</span>
          <HelpTooltip text={inspectorHelpText.subagentsBackground} className="mt-0.5"/>
        </div>
      </div>
      <div className={cardBody}>
        {insight.delegations === 0 && insight.backgroundTransitions === 0 ? (<p className="m-0 text-[0.8rem] text-[var(--text-3)]">No subagent or background activity recorded yet.</p>) : (<div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
            <div className={innerPanel + " p-3"}>
              <Eyebrow className="block">Delegations</Eyebrow>
              <strong className="mt-2 block text-[1.05rem] text-[var(--coordination)]">{insight.delegations}</strong>
            </div>
            <div className={innerPanel + " p-3"}>
              <Eyebrow className="block">Background Events</Eyebrow>
              <strong className="mt-2 block text-[1.05rem] text-[var(--text-1)]">{insight.backgroundTransitions}</strong>
              <p className="mt-1 mb-0 text-[0.74rem] text-[var(--text-3)]">{insight.linkedBackgroundEvents} linked to parent context</p>
            </div>
            <div className={innerPanel + " p-3"}>
              <Eyebrow className="block">Async Tasks</Eyebrow>
              <strong className="mt-2 block text-[1.05rem] text-[var(--text-1)]">{insight.uniqueAsyncTasks}</strong>
              <p className="mt-1 mb-0 text-[0.74rem] text-[var(--text-3)]">
                {insight.completedAsyncTasks} completed · {insight.unresolvedAsyncTasks} unresolved
              </p>
            </div>
          </div>)}
      </div>
    </PanelCard>);
}

function VerificationCyclesCard({ items }: {
    readonly items: readonly VerificationCycleItem[];
}): React.JSX.Element | null {
    if (items.length === 0) return null;
    return (<SectionCard title="Verification Cycles" helpText={inspectorHelpText.verificationCycles}>
      <div className="flex flex-col divide-y divide-[var(--border)]">
        {items.map((item) => (<div key={item.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
            <span className={cn(
                "mt-0.5 shrink-0 rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono text-[0.62rem] font-bold uppercase tracking-wider",
                item.status === "pass"
                    ? "bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-[var(--ok)]"
                    : "bg-[color-mix(in_srgb,var(--err)_12%,transparent)] text-[var(--err)]"
            )}>
              {item.status === "pass" ? "Pass" : "Issue"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-[0.78rem] text-[var(--text-1)]">{item.title}</p>
              {item.ruleId && <p className="mt-0.5 m-0 font-mono text-[0.68rem] text-[var(--text-3)]">{item.ruleId}</p>}
            </div>
          </div>))}
      </div>
    </SectionCard>);
}

const TODO_STATE_LABELS: Readonly<Record<string, string>> = {
    added: "Added",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
};
const TODO_STATE_TONE: Readonly<Record<string, "accent" | "success" | "warning" | "danger" | "neutral">> = {
    added: "accent",
    in_progress: "warning",
    completed: "success",
    cancelled: "danger",
};

const OPEN_STATE_RANK: Readonly<Record<string, number>> = {
    in_progress: 0,
    added: 1,
};

function lastTransitionMs(group: TodoGroup): number {
    const last = group.transitions[group.transitions.length - 1];
    return last ? Date.parse(last.event.createdAt) : 0;
}

function isSessionEnded(timeline: readonly TimelineEventRecord[]): boolean {
    return timeline.some((e) => e.kind === "session.ended");
}

function TodoRow({ group, muted, stale }: { readonly group: TodoGroup; readonly muted: boolean; readonly stale: boolean }): React.JSX.Element {
    const last = group.transitions[group.transitions.length - 1];
    return (
      <div className={cn(
        "flex items-center gap-3 rounded-[10px] border px-3 py-2.5",
        muted
          ? "border-[var(--border)] bg-[var(--bg-subtle)] opacity-75"
          : "border-[var(--border)] bg-[var(--surface-2)]"
      )}>
        <Badge tone={TODO_STATE_TONE[group.currentState] ?? "neutral"} size="xs">
          {TODO_STATE_LABELS[group.currentState] ?? group.currentState}
        </Badge>
        {stale && <Badge tone="neutral" size="xs">stale</Badge>}
        <span className={cn(
          "min-w-0 flex-1 truncate text-[0.82rem]",
          muted ? "text-[var(--text-2)] line-through decoration-[var(--text-3)]/40" : "text-[var(--text-1)]"
        )}>{group.title}</span>
        {last && (
          <span className="shrink-0 text-[0.68rem] tabular-nums text-[var(--text-3)]">
            {formatRelativeTime(last.event.createdAt)}
          </span>
        )}
      </div>
    );
}

function TodosSummaryCard({ todoGroups, timeline }: { readonly todoGroups: readonly TodoGroup[]; readonly timeline: readonly TimelineEventRecord[] }): React.JSX.Element | null {
    if (todoGroups.length === 0) return null;
    const sessionEnded = isSessionEnded(timeline);
    const completed = todoGroups.filter((g) => g.currentState === "completed").length;
    const openGroups = todoGroups
        .filter((g) => !g.isTerminal)
        .slice()
        .sort((a, b) => {
            const rank = (OPEN_STATE_RANK[a.currentState] ?? 9) - (OPEN_STATE_RANK[b.currentState] ?? 9);
            if (rank !== 0) return rank;
            return lastTransitionMs(b) - lastTransitionMs(a);
        });
    const doneGroups = todoGroups
        .filter((g) => g.isTerminal)
        .slice()
        .sort((a, b) => lastTransitionMs(b) - lastTransitionMs(a));
    return (<SectionCard title={<span>Todos <span className="ml-1 text-[var(--text-3)] font-normal text-[0.78rem]">({completed}/{todoGroups.length} completed)</span></span>} helpText={inspectorHelpText.todosSummary}>
      <div className="flex flex-col gap-3">
        {openGroups.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Eyebrow className="block">Open</Eyebrow>
              <span className="text-[0.7rem] text-[var(--text-3)] tabular-nums">{openGroups.length}</span>
            </div>
            {openGroups.map((group) => (
              <TodoRow key={group.todoId} group={group} muted={false} stale={sessionEnded}/>
            ))}
          </div>
        )}
        {doneGroups.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Eyebrow className="block">Done</Eyebrow>
              <span className="text-[0.7rem] text-[var(--text-3)] tabular-nums">{doneGroups.length}</span>
            </div>
            {doneGroups.map((group) => (
              <TodoRow key={group.todoId} group={group} muted stale={false}/>
            ))}
          </div>
        )}
      </div>
    </SectionCard>);
}

const QUESTION_PHASE_LABELS: Readonly<Record<string, string>> = {
    asked: "Asked",
    answered: "Answered",
    concluded: "Concluded",
};
const QUESTION_PHASE_TONE: Readonly<Record<string, "neutral" | "accent" | "success">> = {
    asked: "neutral",
    answered: "accent",
    concluded: "success",
};

function QuestionsSummaryCard({ questionGroups }: { readonly questionGroups: readonly QuestionGroup[] }): React.JSX.Element | null {
    if (questionGroups.length === 0) return null;
    const complete = questionGroups.filter((g) => g.isAnswered).length;
    const open = questionGroups.filter((g) => !g.isAnswered).length;
    return (<SectionCard title={<span>Questions <span className="ml-1 text-[var(--text-3)] font-normal text-[0.78rem]">({complete}/{questionGroups.length} resolved)</span></span>} helpText={inspectorHelpText.questionsSummary}>
      <div className="flex flex-col gap-2">
        {questionGroups.map((group) => {
            const latestPhase = group.phases[group.phases.length - 1];
            const questionText = group.phases[0]?.event.body ?? buildInspectorEventTitle(group.phases[0]?.event) ?? group.phases[0]?.event.title ?? "—";
            return (<div key={group.questionId} className="flex items-start gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                <Badge tone={QUESTION_PHASE_TONE[latestPhase?.phase ?? "asked"] ?? "neutral"} size="xs" className="mt-0.5 shrink-0">
                  {QUESTION_PHASE_LABELS[latestPhase?.phase ?? "asked"] ?? (latestPhase?.phase ?? "asked")}
                </Badge>
                <span className="min-w-0 flex-1 text-[0.82rem] text-[var(--text-1)] line-clamp-2">{questionText}</span>
              </div>);
        })}
        {open > 0 && (<p className="m-0 text-[0.74rem] text-[var(--text-3)]">{open} unanswered question{open === 1 ? "" : "s"}</p>)}
      </div>
    </SectionCard>);
}

function SkillListingCard({ summary }: { readonly summary: ReturnType<typeof summarizeSkillListing> }): React.JSX.Element | null {
    if (summary.loads === 0) return null;
    return (<SectionCard title="Skill listing" helpText={inspectorHelpText.skillListing}>
      <div className="flex flex-wrap items-baseline gap-2">
        <strong className="text-[1.3rem] font-semibold tabular-nums text-[var(--text-1)]">
          {summary.latestCount !== null ? summary.latestCount.toLocaleString() : "—"}
        </strong>
        <span className="text-[0.78rem] text-[var(--text-3)]">skills available</span>
        {summary.hasInitialLoad && <Badge tone="accent" size="xs">initial load</Badge>}
      </div>
      <p className="mt-1.5 mb-0 text-[0.72rem] text-[var(--text-3)]">
        {summary.loads} load{summary.loads === 1 ? "" : "s"} recorded
        {summary.latestAt ? ` · last ${formatRelativeTime(summary.latestAt)}` : ""}
      </p>
    </SectionCard>);
}

function AIModelCard({ summary }: { readonly summary: ModelSummary }): React.JSX.Element | null {
    const entries = Object.entries(summary.modelCounts).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return null;
    return (<SectionCard title="AI Model" helpText={inspectorHelpText.aiModel}>
      <div className="flex flex-col gap-2">
        {entries.map(([name, count]) => (<div key={name} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
            <div className="min-w-0 break-words text-[0.83rem] text-[var(--text-2)]">
              <span className={cn("font-mono", name === summary.defaultModelName && "font-semibold text-[var(--text-1)]")}>{name}</span>
              {name === summary.defaultModelName && (<span className="ml-1.5 text-[0.72rem] font-normal text-[var(--text-3)]">default</span>)}
            </div>
            <div className="text-right text-[0.72rem] uppercase tracking-[0.04em] text-[var(--text-3)] tabular-nums">{count} events</div>
          </div>))}
      </div>
      {summary.defaultModelProvider && (<p className="mt-2 mb-0 text-[0.78rem] text-[var(--text-3)]">Provider: {summary.defaultModelProvider}</p>)}
    </SectionCard>);
}

export interface OverviewTabProps {
    readonly subagentInsight: SubagentInsight;
    readonly verificationCycles?: readonly VerificationCycleItem[];
    readonly runtimeSessionId?: string | undefined;
    readonly runtimeSource?: string | undefined;
    readonly workspacePath?: string | undefined;
    readonly timeline?: readonly TimelineEventRecord[];
    readonly todoGroups?: readonly TodoGroup[];
    readonly questionGroups?: readonly QuestionGroup[];
    readonly taskModelSummary?: ModelSummary | undefined;
    readonly partition?: TurnPartition | null;
    readonly focusedGroupId?: string | null;
    readonly onFocusGroup?: ((groupId: string | null) => void) | undefined;
}

export function OverviewTab({ subagentInsight, verificationCycles, runtimeSessionId, runtimeSource, timeline = [], todoGroups = [], questionGroups = [], taskModelSummary, partition = null, focusedGroupId = null, onFocusGroup }: OverviewTabProps): React.JSX.Element {
    const focusedGroup: TurnGroup | null = partition?.groups.find((g) => g.id === focusedGroupId) ?? null;
    const scopedTimeline = useMemo(
        () => (focusedGroup ? filterEventsByGroup(timeline, focusedGroup) : timeline),
        [focusedGroup, timeline],
    );
    const scopedTodoGroups = useMemo(
        () => (focusedGroup ? buildTodoGroups(scopedTimeline) : todoGroups),
        [focusedGroup, scopedTimeline, todoGroups],
    );
    const scopedQuestionGroups = useMemo(
        () => (focusedGroup ? buildQuestionGroups(scopedTimeline) : questionGroups),
        [focusedGroup, scopedTimeline, questionGroups],
    );
    const scopedSubagentInsight = useMemo<SubagentInsight>(
        () => (focusedGroup ? buildSubagentInsight(scopedTimeline) : subagentInsight),
        [focusedGroup, scopedTimeline, subagentInsight],
    );
    const scopedVerificationCycles = useMemo(
        () => (focusedGroup ? buildVerificationCycles(scopedTimeline) : (verificationCycles ?? [])),
        [focusedGroup, scopedTimeline, verificationCycles],
    );
    const skillSummary = useMemo(() => summarizeSkillListing(scopedTimeline), [scopedTimeline]);
    const groups = partition?.groups ?? [];
    const showScopePicker = groups.length > 0 && onFocusGroup !== undefined;
    const turnPreviewByIndex = useMemo(() => {
      const map = new Map<number, string>();
      for (const segment of segmentEventsByTurn(timeline)) {
        if (segment.isPrelude) continue;
        if (segment.requestPreview) map.set(segment.turnIndex, segment.requestPreview);
      }
      return map;
    }, [timeline]);
    const buildGroupOptionLabel = (group: TurnGroup): string => {
      const base = scopeLabelForGroup(group);
      const preview = group.label?.trim()
        ? null
        : turnPreviewByIndex.get(group.from) ?? null;
      const suffix = preview ? ` — ${truncate(preview, 48)}` : "";
      return `${group.visible ? "" : "○ "}${base}${suffix}`;
    };
    return (<div className="panel-tab-inner flex flex-col gap-5 p-4">
      {showScopePicker && (
        <section className="flex flex-col gap-1.5">
          <Eyebrow>Scope</Eyebrow>
          <select
            aria-label="Scope"
            className="w-full max-w-full truncate rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[0.78rem] font-semibold text-[var(--text-1)] transition-colors hover:border-[var(--border-2)] focus-visible:outline-none focus-visible:border-[var(--accent)]"
            value={focusedGroupId ?? ""}
            onChange={(e) => onFocusGroup(e.target.value ? e.target.value : null)}
          >
            <option value="">Whole task</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {buildGroupOptionLabel(group)}
              </option>
            ))}
          </select>
          {focusedGroup && (
            <span className="text-[0.7rem] leading-snug text-[var(--text-3)]">
              Showing derived sections for {scopeLabelForGroup(focusedGroup)}. Task Flow / Signals remain whole-task.
            </span>
          )}
        </section>
      )}
      <RuntimeSessionCard runtimeSessionId={runtimeSessionId} runtimeSource={runtimeSource} timeline={scopedTimeline}/>
      {taskModelSummary && <AIModelCard summary={taskModelSummary}/>}
      <ContextSnapshotCard timeline={scopedTimeline}/>
      <TokenUsageCard timeline={scopedTimeline}/>
      <SkillListingCard summary={skillSummary}/>
      <SubagentInsightCard insight={scopedSubagentInsight}/>
      {scopedVerificationCycles.length > 0 && (<VerificationCyclesCard items={scopedVerificationCycles}/>)}
      <TodosSummaryCard todoGroups={scopedTodoGroups} timeline={scopedTimeline}/>
      <QuestionsSummaryCard questionGroups={scopedQuestionGroups}/>
    </div>);
}
