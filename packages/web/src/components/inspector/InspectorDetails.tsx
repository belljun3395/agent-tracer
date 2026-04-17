import type React from "react";
import { useMemo, useState } from "react";
import { getEventEvidence } from "@monitor/core";
import { buildInspectorEventTitle, evidenceTone, formatEvidenceLevel, getInstructionsBurstFiles, isInstructionsBurstEvent, type ModelSummary, type TimelineConnector, type TimelineEvent } from "@monitor/web-domain";

import { cn } from "../../lib/ui/cn.js";
import { Badge } from "../ui/Badge.js";
import { PanelCard } from "../ui/PanelCard.js";
import { CacheEfficiencyBar } from "./CacheEfficiencyBar.js";
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

function metaString(metadata: Record<string, unknown>, key: string): string | undefined {
    const value = metadata[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function metaStringArray(metadata: Record<string, unknown>, key: string): readonly string[] | undefined {
    const value = metadata[key];
    if (!Array.isArray(value)) return undefined;
    const out = value.filter((v): v is string => typeof v === "string");
    return out.length > 0 ? out : undefined;
}

export function DetailTranscriptContext({ event }: {
    readonly event: TimelineEvent;
}): React.JSX.Element | null {
    const md = event.metadata;
    const isTranscript = metaString(md, "source") === "claude-transcript";
    const attachmentType = metaString(md, "attachmentType");
    const phase = metaString(md, "phase");
    const assistantUuid = metaString(md, "assistantUuid");
    const parentUuid = metaString(md, "parentUuid");
    const requestId = metaString(md, "requestId");
    const model = metaString(md, "model");
    const toolUseId = metaString(md, "toolUseId");
    const addedNames = metaStringArray(md, "addedNames");
    const removedNames = metaStringArray(md, "removedNames");
    const planFilePath = metaString(md, "planFilePath");
    const displayPath = metaString(md, "displayPath") ?? metaString(md, "path");
    const skillCount = typeof md["skillCount"] === "number" ? (md["skillCount"]) : undefined;
    const itemCount = typeof md["itemCount"] === "number" ? (md["itemCount"]) : undefined;
    const redacted = md["redacted"] === true;
    const signatureLength =
        typeof md["signatureLength"] === "number" ? md["signatureLength"] : undefined;

    if (!isTranscript && !toolUseId && !attachmentType && !phase && !redacted) return null;

    const rows: Array<{ key: string; value: React.ReactNode }> = [];
    if (redacted) {
        rows.push({ key: "Thinking", value: "Redacted (signature-only)" });
        if (typeof signatureLength === "number") {
            rows.push({ key: "Signature", value: `${signatureLength} chars` });
        }
    }
    if (attachmentType) rows.push({ key: "Attachment", value: attachmentType });
    if (phase) rows.push({ key: "Phase", value: phase });
    if (displayPath) rows.push({ key: "Path", value: displayPath });
    if (planFilePath) rows.push({ key: "Plan file", value: planFilePath });
    if (typeof skillCount === "number") rows.push({ key: "Skills", value: String(skillCount) });
    if (typeof itemCount === "number") rows.push({ key: "Items", value: String(itemCount) });
    if (addedNames) rows.push({ key: "Added", value: addedNames.join(", ") });
    if (removedNames) rows.push({ key: "Removed", value: removedNames.join(", ") });
    if (model) rows.push({ key: "Model", value: model });
    if (assistantUuid) rows.push({ key: "Assistant UUID", value: assistantUuid });
    if (parentUuid) rows.push({ key: "Parent UUID", value: parentUuid });
    if (requestId) rows.push({ key: "Request", value: requestId });
    if (toolUseId) rows.push({ key: "Tool use", value: toolUseId });

    if (rows.length === 0) return null;

    return (<SectionCard title="Transcript context" bodyClassName="pt-4">
      <KeyValueTable rows={rows}/>
    </SectionCard>);
}

export function DetailInstructionsBurst({ event }: {
    readonly event: TimelineEvent;
}): React.JSX.Element | null {
    if (!isInstructionsBurstEvent(event)) return null;
    const files = getInstructionsBurstFiles(event);
    if (files.length === 0) return null;
    const firstAt = metaString(event.metadata, "firstCreatedAt") ?? event.createdAt;
    const lastAt = metaString(event.metadata, "lastCreatedAt") ?? event.createdAt;
    const firstMs = Date.parse(firstAt);
    const lastMs = Date.parse(lastAt);
    const spanSeconds = Math.max(0, Math.round((lastMs - firstMs) / 100) / 10);
    const reasonCounts = event.metadata["loadReasonCounts"];
    const memoryCounts = event.metadata["memoryTypeCounts"];
    return (<SectionCard title={`Instruction files (${files.length})`} bodyClassName="pt-4">
      <div className="flex flex-col gap-3">
        <KeyValueTable rows={[
            { key: "Span", value: `${spanSeconds.toFixed(1)}s` },
            { key: "First", value: new Date(firstMs).toLocaleTimeString() },
            { key: "Last", value: new Date(lastMs).toLocaleTimeString() },
            ...(isCountRecord(reasonCounts)
                ? [{ key: "Reasons", value: formatCountRecord(reasonCounts) }]
                : []),
            ...(isCountRecord(memoryCounts)
                ? [{ key: "Memory", value: formatCountRecord(memoryCounts) }]
                : [])
        ]}/>
        <ul className={cn("m-0 max-h-[clamp(220px,36vh,360px)] overflow-auto rounded-[10px] border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[0.8rem] leading-6 text-[var(--text-2)] list-none", monoText)}>
          {files.map((file) => (<li key={file.eventId} className="flex items-baseline justify-between gap-3 py-0.5">
            <span className="min-w-0 break-all">{file.relPath}</span>
            <span className="shrink-0 text-[0.7rem] uppercase tracking-[0.04em] text-[var(--text-3)]">
              {file.loadReason}
            </span>
          </li>))}
        </ul>
      </div>
    </SectionCard>);
}

function isCountRecord(value: unknown): value is Record<string, number> {
    if (!value || typeof value !== "object") return false;
    return Object.values(value as Record<string, unknown>).every(
        (entry) => typeof entry === "number"
    );
}

function formatCountRecord(record: Record<string, number>): string {
    return Object.entries(record)
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => `${key} (${count})`)
        .join(", ");
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
    const hasCacheData = inputTokens != null || outputTokens != null;
    return (<SectionCard title="Token Usage" bodyClassName="pt-4">
      {hasCacheData && (
        <div className="mb-3">
          <CacheEfficiencyBar
            inputTokens={inputTokens ?? 0}
            cacheReadTokens={cacheReadTokens ?? 0}
            cacheCreateTokens={cacheCreateTokens ?? 0}
            outputTokens={outputTokens ?? 0}
          />
        </div>
      )}
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

function metaNumber(metadata: Record<string, unknown>, key: string): number | undefined {
    const value = metadata[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Renders a compact meta strip for `thought.logged` events, surfacing model,
 * request/message IDs, signature length, and redaction state when present.
 * Previously the UI showed only "Thinking (redacted)" as body text and hid
 * the rich metadata Anthropic returns on redacted thinking blocks.
 */
export function DetailThoughtMeta({ event }: {
    readonly event: TimelineEvent;
}): React.JSX.Element | null {
    if (event.kind !== "thought.logged") return null;
    const md = event.metadata;
    const model = metaString(md, "model");
    const requestId = metaString(md, "requestId");
    const messageId = metaString(md, "messageId");
    const signatureLength = metaNumber(md, "signatureLength");
    const contentIndex = metaNumber(md, "contentIndex");
    const parentUuid = metaString(md, "parentUuid");
    const redacted = md["redacted"] === true;
    if (!model && !requestId && !messageId && signatureLength === undefined && contentIndex === undefined && !parentUuid && !redacted) {
        return null;
    }

    const description = redacted
        ? `Redacted thinking block — the model returned a signature only${
            signatureLength !== undefined ? ` (${signatureLength.toLocaleString()} chars)` : ""
        }.`
        : "Thinking metadata";

    return (<SectionCard title="Thinking" bodyClassName="pt-4">
      <p className="m-0 mb-3 text-[0.82rem] leading-6 text-[var(--text-2)]">{description}</p>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {redacted && <Badge tone="warning" size="xs">Redacted</Badge>}
        {model && <Badge tone="accent" size="xs">{model}</Badge>}
        {signatureLength !== undefined && (
          <Badge tone="neutral" size="xs">sig {signatureLength.toLocaleString()}</Badge>
        )}
        {contentIndex !== undefined && (
          <Badge tone="neutral" size="xs">idx {contentIndex}</Badge>
        )}
      </div>
      {(requestId || messageId || parentUuid) && (
        <KeyValueTable rows={[
          ...(requestId ? [{ key: "Request", value: requestId }] : []),
          ...(messageId ? [{ key: "Message", value: messageId }] : []),
          ...(parentUuid ? [{ key: "Parent", value: parentUuid }] : [])
        ]}/>
      )}
    </SectionCard>);
}

interface TaskReminderItem {
    readonly id?: string;
    readonly subject?: string;
    readonly description?: string;
    readonly status?: string;
    readonly blocks?: readonly string[];
    readonly blockedBy?: readonly string[];
}

/**
 * Normalizes task_reminder `content` into an array of entries. The live
 * Claude Code transcript emits this field as an array of objects, but
 * ingestion layers (or older payloads) sometimes store it as a JSON-encoded
 * string. Accept both so downstream rendering does not silently drop a real
 * reminder list.
 */
function coerceTaskReminderArray(value: unknown): readonly unknown[] {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
            const parsed: unknown = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            return [];
        }
    }
    return [];
}

function parseTaskReminderItems(value: unknown): readonly TaskReminderItem[] {
    const rawItems = coerceTaskReminderArray(value);
    if (rawItems.length === 0) return [];
    return rawItems.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
        .map((entry) => {
            const id = typeof entry["id"] === "string" ? entry["id"] : undefined;
            const subject = typeof entry["subject"] === "string" ? entry["subject"] : undefined;
            const description = typeof entry["description"] === "string" ? entry["description"] : undefined;
            const status = typeof entry["status"] === "string" ? entry["status"] : undefined;
            const blocks = Array.isArray(entry["blocks"])
                ? entry["blocks"].filter((v): v is string => typeof v === "string")
                : undefined;
            const blockedBy = Array.isArray(entry["blockedBy"])
                ? entry["blockedBy"].filter((v): v is string => typeof v === "string")
                : undefined;
            const out: TaskReminderItem = {};
            if (id !== undefined) Object.assign(out, { id });
            if (subject !== undefined) Object.assign(out, { subject });
            if (description !== undefined) Object.assign(out, { description });
            if (status !== undefined) Object.assign(out, { status });
            if (blocks !== undefined) Object.assign(out, { blocks });
            if (blockedBy !== undefined) Object.assign(out, { blockedBy });
            return out;
        });
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
    readonly event: TimelineEvent;
}): React.JSX.Element | null {
    if (event.kind !== "context.saved") return null;
    if (metaString(event.metadata, "attachmentType") !== "task_reminder") return null;
    const items = parseTaskReminderItems(event.metadata["content"]);
    if (items.length === 0) return null;
    const itemCount = metaNumber(event.metadata, "itemCount") ?? items.length;

    return (<SectionCard title={`Task reminders (${itemCount})`} bodyClassName="pt-4">
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
    </SectionCard>);
}

const DEFERRED_TOOLS_PREVIEW = 10;
const DEFERRED_TOOLS_SEARCH_THRESHOLD = 20;

/**
 * Renders a `instructions.loaded` event with `attachmentType="deferred_tools_delta"`
 * as a collapsible tool-name list. When the total exceeds
 * DEFERRED_TOOLS_SEARCH_THRESHOLD, a client-side filter input is shown.
 */
export function DetailDeferredToolsDelta({ event }: {
    readonly event: TimelineEvent;
}): React.JSX.Element | null {
    if (event.kind !== "instructions.loaded") return null;
    if (metaString(event.metadata, "attachmentType") !== "deferred_tools_delta") return null;
    const addedNames = metaStringArray(event.metadata, "addedNames");
    if (!addedNames) return null;

    return (<DeferredToolsDeltaBody names={addedNames}/>);
}

function DeferredToolsDeltaBody({ names }: {
    readonly names: readonly string[];
}): React.JSX.Element {
    const [expanded, setExpanded] = useState(false);
    const [filter, setFilter] = useState("");
    const filtered = useMemo(() => {
        const needle = filter.trim().toLowerCase();
        if (!needle) return names;
        return names.filter((name) => name.toLowerCase().includes(needle));
    }, [filter, names]);
    const showSearch = names.length > DEFERRED_TOOLS_SEARCH_THRESHOLD;
    const preview = filtered.slice(0, DEFERRED_TOOLS_PREVIEW);
    const overflow = filtered.length - preview.length;
    const displayed = expanded ? filtered : preview;

    return (<SectionCard title={`Deferred tools (${names.length})`} bodyClassName="pt-4">
      {showSearch && (
        <input
          className="mb-3 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[0.78rem] text-[var(--text-1)] outline-none transition-colors focus:border-[var(--accent)]"
          onChange={(event) => setFilter(event.target.value)}
          placeholder={`Filter ${names.length} tools...`}
          type="search"
          value={filter}
        />
      )}
      <ul className={cn("m-0 flex flex-col gap-0.5 p-0 list-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2", monoText)}>
        {displayed.length === 0 ? (
          <li className="py-1 text-[0.76rem] text-[var(--text-3)]">No matches.</li>
        ) : (
          displayed.map((name) => (
            <li key={name} className="py-0.5 text-[0.78rem] text-[var(--text-2)]">{name}</li>
          ))
        )}
      </ul>
      {!expanded && overflow > 0 && !filter && (
        <button
          type="button"
          className="mt-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[0.72rem] font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
          onClick={() => setExpanded(true)}
        >
          Show {overflow} more
        </button>
      )}
      {expanded && (
        <button
          type="button"
          className="mt-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[0.72rem] font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
          onClick={() => setExpanded(false)}
        >
          Collapse
        </button>
      )}
    </SectionCard>);
}

/**
 * Renders a `instructions.loaded` event with
 * `attachmentType="mcp_instructions_delta"`. Names are shown as badges and
 * each instruction block is rendered as a collapsible text panel.
 */
export function DetailMcpInstructionsDelta({ event }: {
    readonly event: TimelineEvent;
}): React.JSX.Element | null {
    if (event.kind !== "instructions.loaded") return null;
    if (metaString(event.metadata, "attachmentType") !== "mcp_instructions_delta") return null;
    const addedNames = metaStringArray(event.metadata, "addedNames");
    const rawBlocks = event.metadata["addedBlocks"];
    const addedBlocks: readonly string[] = Array.isArray(rawBlocks)
        ? rawBlocks.filter((v): v is string => typeof v === "string")
        : [];
    if (!addedNames && addedBlocks.length === 0) return null;

    return (<SectionCard title={`MCP instructions (${addedNames?.length ?? addedBlocks.length})`} bodyClassName="pt-4">
      {addedNames && addedNames.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {addedNames.map((name) => (
            <Badge key={name} tone="accent" size="xs">{name}</Badge>
          ))}
        </div>
      )}
      {addedBlocks.length > 0 && (
        <div className="flex flex-col gap-2">
          {addedBlocks.map((block, index) => (
            <McpInstructionBlock key={index} index={index} content={block} name={addedNames?.[index]}/>
          ))}
        </div>
      )}
    </SectionCard>);
}

function McpInstructionBlock({ index, content, name }: {
    readonly index: number;
    readonly content: string;
    readonly name: string | undefined;
}): React.JSX.Element {
    const [expanded, setExpanded] = useState(false);
    const isLong = content.length > 240;
    const label = name ?? `Block ${index + 1}`;
    return (
      <details
        className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-subtle)]"
        open={expanded || !isLong}
        onToggle={(event) => setExpanded((event.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer list-none px-3 py-2 text-[0.78rem] font-semibold text-[var(--text-1)] outline-none hover:text-[var(--accent)]">
          {label}
          <span className="ml-2 text-[0.68rem] font-normal text-[var(--text-3)]">
            {content.length.toLocaleString()} chars
          </span>
        </summary>
        <pre className={cn("m-0 max-h-[clamp(180px,28vh,320px)] overflow-auto whitespace-pre-wrap break-words border-t border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[0.76rem] leading-5 text-[var(--text-2)]", monoText)}>
          {content}
        </pre>
      </details>
    );
}

/**
 * Renders a `instructions.loaded` event with `attachmentType="skill_listing"`.
 * Shows the skill count with an "(initial load)" tag when `isInitial` is true,
 * plus the body if present.
 */
export function DetailSkillListing({ event }: {
    readonly event: TimelineEvent;
}): React.JSX.Element | null {
    if (event.kind !== "instructions.loaded") return null;
    if (metaString(event.metadata, "attachmentType") !== "skill_listing") return null;
    const skillCount = metaNumber(event.metadata, "skillCount");
    const isInitial = event.metadata["isInitial"] === true;
    const body = event.body?.trim();

    return (<SectionCard title="Skill listing" bodyClassName="pt-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <strong className="text-[1.05rem] text-[var(--text-1)]">
          {skillCount !== undefined ? skillCount.toLocaleString() : "—"}
        </strong>
        <span className="text-[0.78rem] text-[var(--text-3)]">skills available</span>
        {isInitial && <Badge tone="accent" size="xs">initial load</Badge>}
      </div>
      {body && (
        <pre className={cn("m-0 max-h-[clamp(200px,30vh,360px)] overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[0.78rem] leading-5 text-[var(--text-2)]", monoText)}>
          {body}
        </pre>
      )}
    </SectionCard>);
}

function formatMemoryType(value: string): string {
    return value.replace(/[_-]/g, " ");
}

/**
 * Renders a `context.saved` event with `attachmentType="nested_memory"`:
 * highlights memoryType as a badge and shows the (display) path prominently.
 */
export function DetailNestedMemory({ event }: {
    readonly event: TimelineEvent;
}): React.JSX.Element | null {
    if (event.kind !== "context.saved") return null;
    if (metaString(event.metadata, "attachmentType") !== "nested_memory") return null;
    const path = metaString(event.metadata, "path");
    const displayPath = metaString(event.metadata, "displayPath") ?? path;
    const memoryType = metaString(event.metadata, "memoryType");
    if (!displayPath && !memoryType) return null;

    return (<SectionCard title="Nested memory" bodyClassName="pt-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {memoryType && <Badge tone="accent" size="xs">{formatMemoryType(memoryType)}</Badge>}
      </div>
      {displayPath && (
        <code className={cn("block break-all rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[0.8rem] text-[var(--text-1)]", monoText)}>
          {displayPath}
        </code>
      )}
      {path && path !== displayPath && (
        <p className={cn("mt-1.5 mb-0 text-[0.72rem] text-[var(--text-3)]", monoText)}>
          Absolute: {path}
        </p>
      )}
    </SectionCard>);
}

/**
 * Renders a subagent `action.logged` event. Surfaces agentType, agentId,
 * parent/child taskIds, and async task info. When a childTaskId is present,
 * a link to the child task workspace is provided so users can dive in.
 */
export function DetailSubagentAction({ event }: {
    readonly event: TimelineEvent;
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

    return (<SectionCard title="Subagent" bodyClassName="pt-4">
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
