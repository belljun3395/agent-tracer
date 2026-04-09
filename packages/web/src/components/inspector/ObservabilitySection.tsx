import type React from "react";
import { cn } from "../../lib/ui/cn.js";
import { formatCount, formatDuration, formatPhaseLabel, formatRate } from "../../lib/observability.js";
import type { TaskObservabilityResponse } from "../../types.js";
import { Badge } from "../ui/Badge.js";
export function formatTraceLinkCoverageNote(observability: TaskObservabilityResponse["observability"]): string {
    if (observability.traceLinkEligibleEventCount === 0) {
        return "no link-eligible events";
    }
    return `${formatCount(observability.traceLinkedEventCount)}/${formatCount(observability.traceLinkEligibleEventCount)} eligible events linked`;
}
export function formatTraceLinkHealthNote(observability: TaskObservabilityResponse["observability"]): string {
    if (observability.traceLinkEligibleEventCount === 0) {
        return "no eligible events to link";
    }
    return `${formatCount(observability.traceLinkedEventCount)}/${formatCount(observability.traceLinkEligibleEventCount)} eligible events linked`;
}
export function formatActionRegistryGapNote(observability: TaskObservabilityResponse["observability"]): string {
    if (observability.actionRegistryEligibleEventCount === 0) {
        return "no action events to classify";
    }
    return `${formatCount(observability.actionRegistryGapCount)}/${formatCount(observability.actionRegistryEligibleEventCount)} action events without registry matches`;
}
export function ObservabilityMetricGrid({ items }: {
    readonly items: ReadonlyArray<{
        readonly label: string;
        readonly value: string;
        readonly note?: string;
        readonly tone?: "neutral" | "accent" | "ok" | "warn" | "danger";
    }>;
}): React.JSX.Element {
    const toneClassName: Record<"neutral" | "accent" | "ok" | "warn" | "danger", string> = {
        neutral: "border-[var(--border)] bg-[var(--bg)]",
        accent: "border-[color-mix(in_srgb,var(--accent)_22%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]",
        ok: "border-[color-mix(in_srgb,var(--ok)_24%,var(--border))] bg-[var(--ok-bg)]",
        warn: "border-[color-mix(in_srgb,var(--warn)_24%,var(--border))] bg-[var(--warn-bg)]",
        danger: "border-[color-mix(in_srgb,var(--err)_24%,var(--border))] bg-[var(--err-bg)]"
    };
    return (<div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (<div key={`${item.label}-${item.value}`} className={cn("rounded-[12px] border px-3.5 py-3", toneClassName[item.tone ?? "neutral"])}>
          <div className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">{item.label}</div>
          <div className="mt-1 text-[0.98rem] font-semibold text-[var(--text-1)]">{item.value}</div>
          {item.note && <p className="mt-1 m-0 text-[0.74rem] text-[var(--text-3)]">{item.note}</p>}
        </div>))}
    </div>);
}
export function ObservabilityList({ emptyLabel, items }: {
    readonly items: ReadonlyArray<{
        readonly label: string;
        readonly value: string;
        readonly note?: string;
        readonly tone?: "neutral" | "accent" | "success" | "warning" | "danger";
    }>;
    readonly emptyLabel: string;
}): React.JSX.Element {
    if (items.length === 0) {
        return <p className="m-0 text-[0.8rem] text-[var(--text-3)]">{emptyLabel}</p>;
    }
    return (<div className="flex flex-col gap-2.5">
      {items.map((item) => (<div key={`${item.label}-${item.value}`} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <strong className="min-w-0 truncate text-[0.84rem] text-[var(--text-1)]">{item.label}</strong>
            <Badge tone={item.tone ?? "neutral"} size="xs">{item.value}</Badge>
          </div>
          {item.note && <p className="mt-1.5 mb-0 text-[0.76rem] text-[var(--text-3)]">{item.note}</p>}
        </div>))}
    </div>);
}
export function ObservabilityPhaseBreakdown({ phases }: {
    readonly phases: readonly {
        readonly phase: string;
        readonly durationMs: number;
        readonly share: number;
    }[];
}): React.JSX.Element {
    if (phases.length === 0) {
        return <p className="m-0 text-[0.8rem] text-[var(--text-3)]">No phase data recorded yet.</p>;
    }
    return (<div className="flex flex-col gap-3">
      {phases.map((phase) => {
            const share = phase.share > 1 ? phase.share / 100 : phase.share;
            return (<div key={phase.phase} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-[0.84rem] text-[var(--text-1)]">{formatPhaseLabel(phase.phase)}</strong>
              <Badge tone="accent" size="xs">{formatRate(phase.share)}</Badge>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-2)]">
              <span className="block h-full rounded-full bg-[linear-gradient(90deg,var(--accent),color-mix(in_srgb,var(--accent)_55%,white))]" style={{ width: `${Math.max(4, share * 100)}%` }}/>
            </div>
            <p className="mt-2 mb-0 text-[0.76rem] text-[var(--text-3)]">{formatDuration(phase.durationMs)}</p>
          </div>);
        })}
    </div>);
}
