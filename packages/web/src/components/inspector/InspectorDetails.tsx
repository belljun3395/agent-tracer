import type React from "react";
import { getEventEvidence } from "@monitor/core";
import { buildInspectorEventTitle, evidenceTone, formatEvidenceLevel, type ModelSummary } from "@monitor/web-core";
import type { TimelineConnector, TimelineEvent } from "@monitor/web-core";

import { cn } from "../../lib/ui/cn.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { PanelCard } from "../ui/PanelCard.js";
import { SectionCard } from "./SectionCard.js";
import { cardShell, monoText } from "./styles.js";
import { summarizeDetailText } from "./utils.js";

export function DetailEventEvidence({ event, runtimeSource }: {
    readonly event: TimelineEvent;
    readonly runtimeSource?: string | undefined;
}): React.JSX.Element {
    const evidence = getEventEvidence(runtimeSource, event);
    return (<SectionCard title="Evidence" bodyClassName="pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={evidenceTone(evidence.level)} size="xs">
          {formatEvidenceLevel(evidence.level)}
        </Badge>
        <span className="text-[0.8rem] text-[var(--text-2)]">{evidence.reason}</span>
      </div>
    </SectionCard>);
}

export function InspectorHeaderCard({ eyebrow, title, description, actions, children }: {
    readonly eyebrow: string;
    readonly title: React.ReactNode;
    readonly description: React.ReactNode;
    readonly actions: React.ReactNode;
    readonly children?: React.ReactNode;
}): React.JSX.Element {
    return (<PanelCard className={cn(cardShell, "bg-[var(--surface)]")}>
      <div className="flex flex-col gap-4 px-5 py-5">
        <div className="min-w-0">
          <p className="mb-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--text-3)]">{eyebrow}</p>
          {typeof title === "string"
            ? <h2 className="text-[1.02rem] font-semibold leading-6 text-[var(--text-1)]">{title}</h2>
            : <div className="text-[1.02rem] font-semibold leading-6 text-[var(--text-1)]">{title}</div>}
          <p className="mt-1 text-[0.82rem] leading-6 text-[var(--text-2)]">{description}</p>
          {children}
        </div>
        <div className="flex flex-col gap-2">{actions}</div>
      </div>
    </PanelCard>);
}

export function KeyValueTable({ rows }: {
    readonly rows: ReadonlyArray<{
        readonly key: string;
        readonly value: React.ReactNode;
    }>;
}): React.JSX.Element {
    return (<div className="flex flex-col gap-2">
      {rows.map((row) => (<div key={row.key} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3">
          <div className="pt-0.5 text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-[var(--text-3)]">{row.key}</div>
          <div className={cn("min-w-0 break-words text-[0.83rem] text-[var(--text-2)]", monoText)}>{row.value}</div>
        </div>))}
    </div>);
}

export function DetailSection({ label, mono = false, resizable = false, value }: {
    readonly label: string;
    readonly mono?: boolean;
    readonly resizable?: boolean;
    readonly value: string;
}): React.JSX.Element {
    return (<SectionCard title={label}>
      <pre className={cn("m-0 max-h-[clamp(220px,28vh,300px)] overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-[var(--border)] bg-[var(--bg)] px-4 py-4 text-[0.88rem] leading-7 text-[var(--text-2)]", mono ? monoText : "", mono && "text-[0.8rem] leading-6", resizable && "min-h-44 resize-y", label === "Full Context" && "max-h-[clamp(300px,36vh,420px)]", mono && "max-h-[clamp(260px,34vh,420px)]", mono && resizable && "max-h-[min(72vh,760px)]")}>
        {value}
      </pre>
    </SectionCard>);
}

export function DetailIds({ event, runtimeSessionId }: {
    readonly event: TimelineEvent;
    readonly runtimeSessionId?: string | undefined;
}): React.JSX.Element {
    return (<SectionCard title="IDs" bodyClassName="pt-4">
      <KeyValueTable rows={[
            { key: "Event", value: event.id },
            { key: "Task", value: event.taskId },
            ...(runtimeSessionId ? [{ key: "Session", value: runtimeSessionId }] : []),
            { key: "Time", value: new Date(event.createdAt).toLocaleTimeString() }
        ]}/>
    </SectionCard>);
}

export function DetailConnectorIds({ connector, source, target }: {
    readonly connector: TimelineConnector;
    readonly source: TimelineEvent;
    readonly target: TimelineEvent;
}): React.JSX.Element {
    return (<SectionCard title="IDs" bodyClassName="pt-4">
      <KeyValueTable rows={[
            { key: "Path", value: connector.key },
            { key: "From", value: source.id },
            { key: "To", value: target.id },
            { key: "Time", value: new Date(target.createdAt).toLocaleTimeString() }
        ]}/>
    </SectionCard>);
}

export function DetailTags({ title, values, activeValue, onSelect }: {
    readonly title: string;
    readonly values: readonly string[];
    readonly activeValue?: string | null;
    readonly onSelect?: (value: string) => void;
}): React.JSX.Element {
    return (<SectionCard title={title} bodyClassName="pt-4">
      <div className="flex flex-wrap gap-2">
        {values.length === 0
            ? <span className="text-[0.8rem] text-[var(--text-3)]">No tags</span>
            : values.map((v) => (onSelect ? (<Button key={v} className={cn("h-auto rounded-full border px-3.5 py-1.5 text-[0.78rem] font-semibold shadow-none transition-colors", activeValue === v
                    ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-2)] hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]")} onClick={() => onSelect(v)} size="sm" type="button" variant="bare">
                  {v}
                </Button>) : (<Badge key={v} className="max-w-full break-words px-3 py-1.5 text-[0.78rem] font-medium">
                  {v}
                </Badge>)))}
      </div>
    </SectionCard>);
}

export function DetailMatchList({ event, activeRuleId, onSelectRule }: {
    readonly event: TimelineEvent;
    readonly activeRuleId?: string | null;
    readonly onSelectRule?: (ruleId: string) => void;
}): React.JSX.Element {
    return (<SectionCard title="Classification Matches" bodyClassName="pt-4">
      {event.classification.matches.length === 0 ? (<p className="m-0 text-[0.8rem] text-[var(--text-3)]">No classifier matched this event.</p>) : (<div className="flex flex-col gap-3">
          {event.classification.matches.map((match) => (<div key={`${event.id}-${match.ruleId}`} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                {onSelectRule ? (<button className={cn("min-w-0 truncate bg-transparent p-0 text-left text-[0.95rem] font-semibold transition-colors", activeRuleId === match.ruleId ? "text-[var(--accent)]" : "text-[var(--text-1)]")} onClick={() => onSelectRule(match.ruleId)} type="button">
                    {match.ruleId}
                  </button>) : (<strong className="min-w-0 truncate text-[0.95rem] text-[var(--text-1)]">{match.ruleId}</strong>)}
                <Badge tone="accent" size="xs">
                  {match.score} · {match.source ?? "action-registry"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {match.tags.map((tag) => (<Badge key={tag} tone="neutral" size="xs" className="max-w-full break-words">
                    {tag}
                  </Badge>))}
              </div>
              <ul className="mt-2 flex flex-col gap-1 pl-4 text-[0.76rem] leading-6 text-[var(--text-2)]">
                {match.reasons.map((reason) => (<li key={`${reason.kind}-${reason.value}`}>
                    {reason.kind}: <span className={monoText}>{reason.value}</span>
                  </li>))}
              </ul>
            </div>))}
        </div>)}
    </SectionCard>);
}

export function DetailConnectorEvents({ source, target }: {
    readonly source: TimelineEvent;
    readonly target: TimelineEvent;
}): React.JSX.Element {
    return (<SectionCard title="Connected Events" bodyClassName="pt-4">
      <div className="flex flex-col gap-3">
        {[source, target].map((event, index) => (<div key={event.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <strong className="text-[0.9rem] text-[var(--text-1)]">{index === 0 ? "From" : "To"}</strong>
              <Badge tone="neutral" size="xs">{event.lane}</Badge>
            </div>
            <p className="m-0 text-[0.82rem] leading-6 text-[var(--text-2)]">{buildInspectorEventTitle(event) ?? event.title}</p>
          </div>))}
      </div>
    </SectionCard>);
}

export function DetailRelatedEvents({ events }: {
    readonly events: readonly TimelineEvent[];
}): React.JSX.Element {
    return (<SectionCard title="Related Events" bodyClassName="pt-4">
      {events.length === 0 ? (<p className="m-0 text-[0.8rem] text-[var(--text-3)]">No related events linked from metadata.</p>) : (<div className="flex flex-col gap-3">
          {events.map((event) => (<div key={event.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <strong className="text-[0.9rem] text-[var(--text-1)]">{buildInspectorEventTitle(event) ?? event.title}</strong>
                <Badge tone="neutral" size="xs">{event.lane}</Badge>
              </div>
              <p className="m-0 text-[0.82rem] leading-6 text-[var(--text-2)]">{summarizeDetailText(event.body ?? event.kind)}</p>
            </div>))}
        </div>)}
    </SectionCard>);
}

export function DetailModelInfo({ modelName, modelProvider }: {
    readonly modelName: string;
    readonly modelProvider?: string | undefined;
}): React.JSX.Element {
    return (<SectionCard title="Model" bodyClassName="pt-4">
      <KeyValueTable rows={[
            { key: "Name", value: modelName },
            ...(modelProvider ? [{ key: "Provider", value: modelProvider }] : [])
        ]}/>
    </SectionCard>);
}

export function DetailTokenUsage({ event }: {
    readonly event: TimelineEvent;
}): React.JSX.Element {
    const inputTokens = event.metadata["inputTokens"] as number | undefined;
    const outputTokens = event.metadata["outputTokens"] as number | undefined;
    const cacheReadTokens = event.metadata["cacheReadTokens"] as number | undefined;
    const cacheCreateTokens = event.metadata["cacheCreateTokens"] as number | undefined;
    const stopReason = event.metadata["stopReason"] as string | undefined;
    const rows = [
        ...(inputTokens != null ? [{ key: "Input Tokens", value: inputTokens.toLocaleString() }] : []),
        ...(outputTokens != null ? [{ key: "Output Tokens", value: outputTokens.toLocaleString() }] : []),
        ...(cacheReadTokens != null ? [{ key: "Cache Read Tokens", value: cacheReadTokens.toLocaleString() }] : []),
        ...(cacheCreateTokens != null ? [{ key: "Cache Create Tokens", value: cacheCreateTokens.toLocaleString() }] : []),
        ...(stopReason ? [{ key: "Stop Reason", value: stopReason }] : [])
    ];
    if (rows.length === 0)
        return <></>;
    return (<SectionCard title="Token Usage" bodyClassName="pt-4">
      <KeyValueTable rows={rows}/>
    </SectionCard>);
}

export function DetailCaptureInfo({ event }: {
    readonly event: TimelineEvent;
}): React.JSX.Element {
    const captureMode = event.metadata["captureMode"] as string | undefined;
    const messageId = event.metadata["messageId"] as string | undefined;
    const source = event.metadata["source"] as string | undefined;
    const phase = event.metadata["phase"] as string | undefined;
    if (!captureMode && !messageId && !source && !phase)
        return <></>;
    return (<SectionCard title="Capture Info" bodyClassName="pt-4">
      <KeyValueTable rows={[
            ...(captureMode ? [{ key: "Mode", value: captureMode }] : []),
            ...(messageId ? [{ key: "Message ID", value: messageId }] : []),
            ...(source ? [{ key: "Source", value: source }] : []),
            ...(phase ? [{ key: "Phase", value: phase }] : [])
        ]}/>
    </SectionCard>);
}

export function DetailTaskModel({ summary }: {
    readonly summary: ModelSummary;
}): React.JSX.Element | null {
    const entries = Object.entries(summary.modelCounts).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0)
        return null;
    return (<SectionCard title="AI Model" bodyClassName="pt-4">
      <div className="flex flex-col gap-2">
        {entries.map(([name, count]) => (<div key={name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <div className="min-w-0 break-words text-[0.83rem] text-[var(--text-2)]">
              <span className={cn("font-mono", name === summary.defaultModelName && "font-semibold text-[var(--text-1)]")}>{name}</span>
              {name === summary.defaultModelName && (<span className="ml-1.5 text-[0.72rem] font-normal text-[var(--text-3)]">default</span>)}
            </div>
            <div className="text-right text-[0.72rem] uppercase tracking-[0.04em] text-[var(--text-3)]">{count} events</div>
          </div>))}
      </div>
      {summary.defaultModelProvider && (<p className="mt-2 text-[0.8rem] text-[var(--text-3)]">Provider: {summary.defaultModelProvider}</p>)}
    </SectionCard>);
}
