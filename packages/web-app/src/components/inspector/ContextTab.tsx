import type React from "react";
import { useMemo, useState } from "react";
import { formatRelativeTime, selectContextHydrationEvents, type TimelineEvent } from "@monitor/web-domain";
import { cn } from "../../lib/ui/cn.js";
import { Badge } from "../ui/Badge.js";
import { PanelCard } from "../ui/PanelCard.js";
import { cardShell, cardHeader, cardBody, monoText } from "./styles.js";
import { HelpTooltip } from "../ui/HelpTooltip.js";
import { inspectorHelpText } from "./helpText.js";

interface ContextTabProps {
    readonly timeline: readonly TimelineEvent[];
}

function metaString(metadata: TimelineEvent["metadata"], key: string): string | null {
    const value = metadata[key];
    return typeof value === "string" && value.length > 0 ? value : null;
}

function metaNumber(metadata: TimelineEvent["metadata"], key: string): number | null {
    const value = metadata[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

interface InstructionRow {
    readonly event: TimelineEvent;
    readonly title: string;
    readonly pathHint: string | null;
    readonly body: string | null;
    readonly loadReason: string | null;
    readonly memoryType: string | null;
    readonly skillCount: number | null;
    readonly addedNames: readonly string[] | null;
    readonly removedNames: readonly string[] | null;
    readonly skillNames: readonly string[] | null;
}

function toStringList(val: unknown): readonly string[] | null {
    return Array.isArray(val) && val.every((v) => typeof v === "string")
        ? (val as string[])
        : null;
}

function parseSkillNames(body: string | null): readonly string[] | null {
    if (!body) return null;
    const names: string[] = [];
    for (const line of body.split("\n")) {
        const m = /^-\s+([\w:./-]+)/.exec(line.trim());
        if (m?.[1]) names.push(m[1]);
    }
    return names.length > 0 ? names : null;
}

function buildInstructionRow(event: TimelineEvent): InstructionRow {
    const relPath = metaString(event.metadata, "relPath");
    const filePath = metaString(event.metadata, "filePath");
    const attachmentType = metaString(event.metadata, "attachmentType");
    return {
        event,
        title: event.title,
        pathHint: relPath ?? filePath,
        body: event.body ?? null,
        loadReason: metaString(event.metadata, "loadReason"),
        memoryType: metaString(event.metadata, "memoryType"),
        skillCount: metaNumber(event.metadata, "skillCount"),
        addedNames: toStringList(event.metadata["addedNames"]),
        removedNames: toStringList(event.metadata["removedNames"]),
        skillNames: attachmentType === "skill_listing" ? parseSkillNames(event.body ?? null) : null,
    };
}

function ExpandableNameList({ names, label }: { readonly names: readonly string[]; readonly label: string }): React.JSX.Element {
    const [expanded, setExpanded] = useState(false);
    return (
        <div>
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[0.68rem] text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
            >
                <span className="font-semibold">{label} ({names.length})</span>
                <span>{expanded ? "▲" : "▼"}</span>
            </button>
            {expanded && (
                <ul className="mt-1.5 flex flex-col gap-0.5 pl-2">
                    {names.map((name) => (
                        <li key={name} className={cn("truncate text-[0.72rem] text-[var(--text-2)]", monoText)}>
                            {name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function InstructionRowItem({ row }: { readonly row: InstructionRow }): React.JSX.Element {
    const expandableNames = row.skillNames ?? row.addedNames;
    const expandLabel = row.skillNames ? "skills" : "added";
    return (
        <div className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
                <strong className="min-w-0 flex-1 break-words text-[0.82rem] text-[var(--text-1)]">
                    {row.title}
                </strong>
                <span className="shrink-0 text-[0.68rem] tabular-nums text-[var(--text-3)]">
                    {formatRelativeTime(row.event.createdAt)}
                </span>
            </div>
            {row.pathHint && (
                <span className={cn("break-all text-[0.76rem] text-[var(--text-2)]", monoText)} title={row.pathHint}>
                    {row.pathHint}
                </span>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
                {row.loadReason && (
                    <Badge tone={row.loadReason === "compact" ? "warning" : "neutral"} size="xs">
                        {row.loadReason}
                    </Badge>
                )}
                {row.memoryType && (
                    <Badge tone="accent" size="xs">{row.memoryType}</Badge>
                )}
                {row.skillCount != null && (
                    <Badge tone="neutral" size="xs">{row.skillCount} skills</Badge>
                )}
                {(row.addedNames != null || row.removedNames != null) && !row.skillNames && (
                    <Badge tone="neutral" size="xs">
                        +{row.addedNames?.length ?? 0} / -{row.removedNames?.length ?? 0}
                    </Badge>
                )}
            </div>
            {expandableNames && expandableNames.length > 0 && (
                <ExpandableNameList names={expandableNames} label={expandLabel} />
            )}
            {row.body && !row.pathHint && !expandableNames && (
                <p className="m-0 max-h-28 overflow-hidden whitespace-pre-wrap break-words text-[0.76rem] text-[var(--text-3)]">
                    {row.body}
                </p>
            )}
        </div>
    );
}

function InstructionsCard({ rows }: { readonly rows: readonly InstructionRow[] }): React.JSX.Element {
    return (
        <PanelCard className={cardShell}>
            <div className={cardHeader}>
                <div className="flex items-start gap-2">
                    <span>Instructions Loaded</span>
                    <HelpTooltip text={inspectorHelpText.instructionsLoaded} className="mt-0.5" />
                </div>
                <Badge tone="neutral" size="xs">{rows.length}</Badge>
            </div>
            <div className={cardBody}>
                {rows.length === 0 ? (
                    <p className="m-0 text-[0.8rem] text-[var(--text-3)]">No instructions loaded yet.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {rows.map((row) => (
                            <InstructionRowItem key={row.event.id} row={row} />
                        ))}
                    </div>
                )}
            </div>
        </PanelCard>
    );
}

interface ContextRow {
    readonly event: TimelineEvent;
    readonly title: string;
    readonly body: string | null;
    readonly displayPath: string | null;
    readonly itemCount: number | null;
    readonly memoryType: string | null;
}

function buildContextRow(event: TimelineEvent): ContextRow {
    return {
        event,
        title: event.title,
        body: event.body ?? null,
        displayPath: metaString(event.metadata, "displayPath") ?? metaString(event.metadata, "path"),
        itemCount: metaNumber(event.metadata, "itemCount"),
        memoryType: metaString(event.metadata, "memoryType"),
    };
}

function ContextSavedCard({ rows }: { readonly rows: readonly ContextRow[] }): React.JSX.Element {
    return (
        <PanelCard className={cardShell}>
            <div className={cardHeader}>
                <div className="flex items-start gap-2">
                    <span>Context Saved</span>
                    <HelpTooltip text={inspectorHelpText.contextSaved} className="mt-0.5" />
                </div>
                <Badge tone="neutral" size="xs">{rows.length}</Badge>
            </div>
            <div className={cardBody}>
                {rows.length === 0 ? (
                    <p className="m-0 text-[0.8rem] text-[var(--text-3)]">No ad-hoc context saves. Compact boundaries stay on the main timeline.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {rows.map((row) => (
                            <div key={row.event.id} className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                                <div className="flex items-start justify-between gap-3">
                                    <strong className="min-w-0 flex-1 break-words text-[0.82rem] text-[var(--text-1)]">
                                        {row.title}
                                    </strong>
                                    <span className="shrink-0 text-[0.68rem] tabular-nums text-[var(--text-3)]">
                                        {formatRelativeTime(row.event.createdAt)}
                                    </span>
                                </div>
                                {row.displayPath && (
                                    <span className={cn("break-all text-[0.76rem] text-[var(--text-2)]", monoText)} title={row.displayPath}>
                                        {row.displayPath}
                                    </span>
                                )}
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {row.itemCount != null && (
                                        <Badge tone="neutral" size="xs">{row.itemCount} items</Badge>
                                    )}
                                    {row.memoryType && (
                                        <Badge tone="accent" size="xs">{row.memoryType}</Badge>
                                    )}
                                </div>
                                {row.body && (
                                    <p className="m-0 max-h-28 overflow-hidden whitespace-pre-wrap break-words text-[0.78rem] text-[var(--text-2)]">
                                        {row.body}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </PanelCard>
    );
}

export function ContextTab({ timeline }: ContextTabProps): React.JSX.Element {
    const { instructionsRows, contextRows } = useMemo(() => {
        const hydrationEvents = selectContextHydrationEvents(timeline);
        const sorted = [...hydrationEvents].sort((a, b) =>
            Date.parse(b.createdAt) - Date.parse(a.createdAt));
        const instructionsRows: InstructionRow[] = [];
        const contextRows: ContextRow[] = [];
        for (const event of sorted) {
            if (event.kind === "instructions.loaded") {
                instructionsRows.push(buildInstructionRow(event));
            } else if (event.kind === "context.saved") {
                contextRows.push(buildContextRow(event));
            }
        }
        return { instructionsRows, contextRows };
    }, [timeline]);

    return (
        <div className="panel-tab-inner flex flex-col gap-5 p-4">
            <InstructionsCard rows={instructionsRows} />
            <ContextSavedCard rows={contextRows} />
        </div>
    );
}
