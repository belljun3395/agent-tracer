import type React from "react";
import { getEventEvidence } from "~domain/evidence.js";
import { evidenceTone, formatEvidenceLevel } from "~app/lib/formatters.js";
import { buildInspectorEventTitle } from "~app/lib/insights/extraction.js";
import type { TimelineConnector } from "~app/lib/timeline.js";
import type { TimelineEventRecord } from "~domain/monitoring.js";
import type { TaskTurnSummary } from "~domain/task-query-contracts.js";

import { cn } from "~app/lib/ui/cn.js";
import { readRuleEnforcements } from "~app/lib/ruleEnforcements.js";
import { Badge } from "../ui/Badge.js";
import { PanelCard } from "../ui/PanelCard.js";
import { inspectorHelpText } from "./helpText.js";
import { SectionCard } from "./SectionCard.js";
import { cardShell, monoText } from "./styles.js";
import { parseTaskReminderItems } from "./taskReminder.js";
import { summarizeDetailText } from "./utils.js";

export function DetailEventEvidence({ event, runtimeSource }: {
    readonly event: TimelineEventRecord;
    readonly runtimeSource?: string | undefined;
}): React.JSX.Element {
    const evidence = getEventEvidence(runtimeSource, event);
    return (<SectionCard title="Evidence" helpText={inspectorHelpText.evidence} bodyClassName="pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={evidenceTone(evidence.level)} size="xs">
          {formatEvidenceLevel(evidence.level)}
        </Badge>
        <span className="text-[0.8rem] text-[var(--text-2)]">{evidence.reason}</span>
      </div>
    </SectionCard>);
}

export function DetailTurnVerdict({ turn }: {
    readonly turn: TaskTurnSummary | null;
}): React.JSX.Element | null {
    if (!turn) return null;
    const status = turn.aggregateVerdict;
    const tone = status === "verified"
        ? "success"
        : status === "contradicted"
            ? "danger"
            : status === "unverifiable"
                ? "warning"
                : "neutral";
    const label = status ?? (turn.status === "open" ? "open" : "not evaluated");
    return (
        <SectionCard title="Turn Verdict" helpText="Definitive rule verdict for the turn containing this event. Open turns only show streaming rule matches until they close." bodyClassName="pt-4">
            <KeyValueTable rows={[
                { key: "Turn", value: `Turn ${turn.turnIndex + 1}` },
                { key: "Status", value: <Badge tone={tone} size="xs">{label}</Badge> },
                { key: "Rules", value: `${turn.rulesEvaluatedCount} evaluated` },
                { key: "Window", value: `${new Date(turn.startedAt).toLocaleTimeString()}${turn.endedAt ? ` - ${new Date(turn.endedAt).toLocaleTimeString()}` : ""}` },
            ]}/>
        </SectionCard>
    );
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

function KeyValueTable({ rows }: {
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

export function DetailSection({ label, helpText, mono = false, resizable = false, value }: {
    readonly label: string;
    readonly helpText?: string;
    readonly mono?: boolean;
    readonly resizable?: boolean;
    readonly value: string;
}): React.JSX.Element {
    return (<SectionCard title={label} {...(helpText ? { helpText } : {})}>
      <pre className={cn("m-0 max-h-[clamp(220px,28vh,300px)] overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-[var(--border)] bg-[var(--bg)] px-4 py-4 text-[0.88rem] leading-7 text-[var(--text-2)]", mono ? monoText : "", mono && "text-[0.8rem] leading-6", resizable && "min-h-44 resize-y", label === "Full Context" && "max-h-[clamp(300px,36vh,420px)]", mono && "max-h-[clamp(260px,34vh,420px)]", mono && resizable && "max-h-[min(72vh,760px)]")}>
        {value}
      </pre>
    </SectionCard>);
}

export function DetailIds({ event, runtimeSessionId }: {
    readonly event: TimelineEventRecord;
    readonly runtimeSessionId?: string | undefined;
}): React.JSX.Element {
    return (<SectionCard title="IDs" helpText={inspectorHelpText.ids} bodyClassName="pt-4">
      <KeyValueTable rows={[
            { key: "Event", value: event.id },
            { key: "Task", value: event.taskId },
            ...(runtimeSessionId ? [{ key: "Session", value: runtimeSessionId }] : []),
            { key: "Time", value: new Date(event.createdAt).toLocaleTimeString() }
        ]}/>
    </SectionCard>);
}

function metaString(metadata: Record<string, unknown>, key: string): string | undefined {
    const value = metadata[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function DetailConnectorIds({ connector, source, target }: {
    readonly connector: TimelineConnector;
    readonly source: TimelineEventRecord;
    readonly target: TimelineEventRecord;
}): React.JSX.Element {
    return (<SectionCard title="IDs" helpText={inspectorHelpText.ids} bodyClassName="pt-4">
      <KeyValueTable rows={[
            { key: "Path", value: connector.key },
            { key: "From", value: source.id },
            { key: "To", value: target.id },
            { key: "Time", value: new Date(target.createdAt).toLocaleTimeString() }
        ]}/>
    </SectionCard>);
}

export function DetailMatchList({ event, activeRuleId, onSelectRule }: {
    readonly event: TimelineEventRecord;
    readonly activeRuleId?: string | null;
    readonly onSelectRule?: (ruleId: string) => void;
}): React.JSX.Element {
    return (<SectionCard title="Classification Matches" helpText={inspectorHelpText.classificationMatches} bodyClassName="pt-4">
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
              <ul className="mt-2 flex flex-col gap-1 pl-4 text-[0.76rem] leading-6 text-[var(--text-2)]">
                {match.reasons.map((reason) => (<li key={`${reason.kind}-${reason.value}`}>
                    {reason.kind}: <span className={monoText}>{reason.value}</span>
                  </li>))}
              </ul>
            </div>))}
        </div>)}
    </SectionCard>);
}

export function DetailRuleEnforcements({ event, activeRuleId, onSelectRule }: {
    readonly event: TimelineEventRecord;
    readonly activeRuleId?: string | null;
    readonly onSelectRule?: (ruleId: string) => void;
}): React.JSX.Element | null {
    const enforcements = readRuleEnforcements(event);
    if (enforcements.length === 0) return null;
    return (
        <SectionCard title="Verification Rules" helpText="Rules that matched this event in the streaming verifier." bodyClassName="pt-4">
            <div className="flex flex-col gap-2">
                {enforcements.map((item) => (
                    <button
                        key={`${event.id}-${item.ruleId}-${item.matchKind}`}
                        type="button"
                        disabled={!onSelectRule}
                        onClick={() => onSelectRule?.(item.ruleId)}
                        className={cn(
                            "flex items-center justify-between gap-3 rounded-[10px] border bg-[var(--surface-2)] px-3 py-2 text-left transition-colors",
                            activeRuleId === item.ruleId
                                ? "border-[var(--rule)] bg-[var(--rule-bg)]"
                                : "border-[var(--border)]",
                            onSelectRule && "hover:border-[var(--rule)]",
                        )}
                    >
                        <span className={cn("min-w-0 truncate text-[0.84rem] font-semibold", activeRuleId === item.ruleId ? "text-[var(--rule)]" : "text-[var(--text-1)]")}>
                            {item.ruleId}
                        </span>
                        <Badge tone={item.matchKind === "trigger" ? "warning" : "success"} size="xs">
                            {item.matchKind === "trigger" ? "watching" : "fulfilled"}
                        </Badge>
                    </button>
                ))}
            </div>
        </SectionCard>
    );
}

export function DetailConnectorEvents({ source, target }: {
    readonly source: TimelineEventRecord;
    readonly target: TimelineEventRecord;
}): React.JSX.Element {
    return (<SectionCard title="Connected Events" helpText={inspectorHelpText.connectedEvents} bodyClassName="pt-4">
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
    readonly events: readonly TimelineEventRecord[];
}): React.JSX.Element {
    return (<SectionCard title="Related Events" helpText={inspectorHelpText.relatedEvents} bodyClassName="pt-4">
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
    return (<SectionCard title="Model" helpText={inspectorHelpText.model} bodyClassName="pt-4">
      <KeyValueTable rows={[
            { key: "Name", value: modelName },
            ...(modelProvider ? [{ key: "Provider", value: modelProvider }] : [])
        ]}/>
    </SectionCard>);
}


export function DetailCaptureInfo({ event }: {
    readonly event: TimelineEventRecord;
}): React.JSX.Element {
    const captureMode = event.metadata["captureMode"] as string | undefined;
    const messageId = event.metadata["messageId"] as string | undefined;
    const source = event.metadata["source"] as string | undefined;
    const phase = event.metadata["phase"] as string | undefined;
    if (!captureMode && !messageId && !source && !phase)
        return <></>;
    return (<SectionCard title="Capture Info" helpText={inspectorHelpText.captureInfo} bodyClassName="pt-4">
      <KeyValueTable rows={[
            ...(captureMode ? [{ key: "Mode", value: captureMode }] : []),
            ...(messageId ? [{ key: "Message ID", value: messageId }] : []),
            ...(source ? [{ key: "Source", value: source }] : []),
            ...(phase ? [{ key: "Phase", value: phase }] : [])
        ]}/>
    </SectionCard>);
}

function metaNumber(metadata: Record<string, unknown>, key: string): number | undefined {
    const value = metadata[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function reminderStatusTone(status: string | undefined): "success" | "accent" | "warning" | "neutral" | "danger" {
    const normalized = (status ?? "").toLowerCase();
    if (normalized === "completed" || normalized === "done") return "success";
    if (normalized === "in_progress" || normalized === "in-progress" || normalized === "active") return "accent";
    if (normalized === "blocked" || normalized === "failed" || normalized === "error") return "danger";
    if (normalized === "pending" || normalized === "waiting") return "warning";
    return "neutral";
}

/**
 * Renders a `context.saved` event with `attachmentType="task_reminder"` as a
 * checklist: status-colored badge, subject, optional description, and any
 * blocking relationships.
 */
export function DetailTaskReminder({ event }: {
    readonly event: TimelineEventRecord;
}): React.JSX.Element | null {
    if (event.kind !== "context.saved") return null;
    if (metaString(event.metadata, "attachmentType") !== "task_reminder") return null;
    const rawContent = event.metadata["content"];
    const items = parseTaskReminderItems(rawContent);
    const itemCount = metaNumber(event.metadata, "itemCount") ?? items.length;
    if (items.length === 0 && itemCount === 0) return null;

    return (<SectionCard title={`Task reminders (${itemCount})`} helpText={inspectorHelpText.taskReminder} bodyClassName="pt-4">
      {items.length === 0 ? (
        <pre className={cn("m-0 max-h-[clamp(180px,28vh,320px)] overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-[var(--border)] bg-[var(--bg)] px-4 py-4 text-[0.76rem] leading-6 text-[var(--text-2)]", monoText)}>
          {typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent ?? null, null, 2)}
        </pre>
      ) : (
      <ul className="m-0 flex flex-col gap-2 p-0 list-none">
        {items.map((item, index) => {
            const key = item.id ?? `${item.subject ?? "reminder"}-${index}`;
            return (
              <li key={key} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={reminderStatusTone(item.status)} size="xs">
                    {(item.status ?? "pending").replace(/[_-]/g, " ")}
                  </Badge>
                  <strong className="min-w-0 text-[0.84rem] text-[var(--text-1)]">
                    {item.subject ?? "Untitled reminder"}
                  </strong>
                </div>
                {item.description && (
                  <p className="mt-1.5 mb-0 text-[0.78rem] leading-5 text-[var(--text-2)]">{item.description}</p>
                )}
                {(item.blockedBy && item.blockedBy.length > 0) && (
                  <p className={cn("mt-1.5 mb-0 text-[0.72rem] text-[var(--text-3)]", monoText)}>
                    Blocked by: {item.blockedBy.join(", ")}
                  </p>
                )}
                {(item.blocks && item.blocks.length > 0) && (
                  <p className={cn("mt-1 mb-0 text-[0.72rem] text-[var(--text-3)]", monoText)}>
                    Blocks: {item.blocks.join(", ")}
                  </p>
                )}
              </li>
            );
        })}
      </ul>
      )}
    </SectionCard>);
}

/**
 * Renders a subagent `action.logged` event. Surfaces agentType, agentId,
 * parent/child taskIds, and async task info. When a childTaskId is present,
 * a link to the child task workspace is provided so users can dive in.
 */
export function DetailSubagentAction({ event }: {
    readonly event: TimelineEventRecord;
}): React.JSX.Element | null {
    if (event.kind !== "action.logged") return null;
    const md = event.metadata;
    const agentType = metaString(md, "agentType");
    const agentId = metaString(md, "agentId");
    const parentTaskId = metaString(md, "parentTaskId");
    const childTaskId = metaString(md, "childTaskId");
    const asyncTaskId = metaString(md, "asyncTaskId");
    const asyncStatus = metaString(md, "asyncStatus");
    if (!agentType && !agentId && !parentTaskId && !childTaskId && !asyncTaskId && !asyncStatus) {
        return null;
    }

    const childHref = childTaskId
        ? `/?task=${encodeURIComponent(childTaskId)}&view=workspace&tab=inspector`
        : null;

    return (<SectionCard title="Subagent" helpText={inspectorHelpText.subagent} bodyClassName="pt-4">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {agentType && <Badge tone="accent" size="xs">{agentType}</Badge>}
        {asyncStatus && (
          <Badge
            tone={asyncStatus === "completed" ? "success" : asyncStatus === "failed" ? "danger" : "warning"}
            size="xs"
          >
            {asyncStatus}
          </Badge>
        )}
      </div>
      <KeyValueTable rows={[
        ...(agentId ? [{ key: "Agent ID", value: agentId }] : []),
        ...(parentTaskId ? [{ key: "Parent task", value: parentTaskId }] : []),
        ...(childTaskId
          ? [{
              key: "Child task",
              value: childHref ? (
                <a
                  className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 text-[0.76rem] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--bg)]"
                  href={childHref}
                >
                  {childTaskId}
                  <span aria-hidden="true">→</span>
                </a>
              ) : childTaskId
            }]
          : []),
        ...(asyncTaskId ? [{ key: "Async task", value: asyncTaskId }] : [])
      ]}/>
    </SectionCard>);
}
