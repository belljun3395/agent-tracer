import type React from "react";
import { useCallback, useMemo, useState } from "react";
import type { TimelineEventRecord } from "~domain/monitoring.js";
import type { VerdictStatus } from "~domain/rule.js";
import { segmentEventsByTurn } from "~domain/segments.js";
import type { TurnSegment } from "~domain/segments.js";
import type { TaskTurnSummary } from "~domain/task-query-contracts.js";
import { filterEventsByGroup, scopeLabelForGroup } from "~domain/turn-partition.js";
import type { TurnGroup, TurnPartition } from "~domain/turn-partition.js";
import { formatDuration } from "~app/lib/formatters.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { Eyebrow } from "../ui/Eyebrow.js";
import { Input } from "../ui/Input.js";
import { cn } from "~app/lib/ui/cn.js";
import { summarizeGroupVerdict, type GroupVerdictSummary } from "./turnVerdict.js";

export interface TurnsTabProps {
    readonly taskId: string | undefined;
    readonly taskTitle: string;
    readonly taskTimeline: readonly TimelineEventRecord[];
    readonly turnSummaries?: readonly TaskTurnSummary[];
    readonly partition: TurnPartition | null;
    readonly focusedGroupId: string | null;
    readonly isSaving: boolean;
    readonly onFocusGroup: (groupId: string | null) => void;
    readonly onMergeNext: (groupId: string) => Promise<void>;
    readonly onSplit: (groupId: string, atTurnIndex: number) => Promise<void>;
    readonly onToggleVisibility: (groupId: string) => Promise<void>;
    readonly onRename: (groupId: string, label: string | null) => Promise<void>;
    readonly onReset: () => Promise<void>;
}

interface GroupMeta {
    readonly turnCount: number;
    readonly eventCount: number;
    readonly durationMs: number | null;
}

export function TurnsTab({
    taskTitle: _taskTitle,
    taskId: _taskId,
    taskTimeline,
    turnSummaries = [],
    partition,
    focusedGroupId,
    isSaving,
    onFocusGroup,
    onMergeNext,
    onSplit,
    onToggleVisibility,
    onRename,
    onReset,
}: TurnsTabProps): React.JSX.Element {
    const segments = useMemo(
        () => segmentEventsByTurn(taskTimeline).filter((s) => !s.isPrelude),
        [taskTimeline],
    );
    const segmentMap = useMemo(() => {
        const map = new Map<number, TurnSegment>();
        for (const s of segments) map.set(s.turnIndex, s);
        return map;
    }, [segments]);

    const groups = partition?.groups ?? [];
    const verdictByGroup = useMemo(() => {
        const map = new Map<string, GroupVerdictSummary | null>();
        for (const group of groups) {
            map.set(group.id, summarizeGroupVerdict(group, segments, turnSummaries));
        }
        return map;
    }, [groups, segments, turnSummaries]);

    const metaByGroup = useMemo(() => {
        const map = new Map<string, GroupMeta>();
        for (const group of groups) {
            map.set(group.id, computeGroupMeta(group, taskTimeline, segmentMap));
        }
        return map;
    }, [groups, taskTimeline, segmentMap]);

    if (!partition || groups.length === 0) {
        return (
            <div className="panel-tab-inner flex flex-col gap-4 p-4">
                <EmptyState />
            </div>
        );
    }

    return (
        <div className="panel-tab-inner flex flex-col gap-4 p-4">
            <Header
                groupCount={groups.length}
                isSaving={isSaving}
                onReset={onReset}
            />

            <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <Eyebrow>Groups</Eyebrow>
                    {focusedGroupId !== null && (
                        <button
                            type="button"
                            className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text-1)]"
                            onClick={() => onFocusGroup(null)}
                        >
                            Clear focus
                        </button>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    {groups.map((group, index) => (
                        <GroupRow
                            key={group.id}
                            group={group}
                            isLast={index === groups.length - 1}
                            isFocused={group.id === focusedGroupId}
                            segmentMap={segmentMap}
                            verdict={verdictByGroup.get(group.id) ?? null}
                            meta={metaByGroup.get(group.id) ?? null}
                            isSaving={isSaving}
                            onFocus={() => onFocusGroup(group.id)}
                            onMergeNext={() => void onMergeNext(group.id)}
                            onSplit={(at) => void onSplit(group.id, at)}
                            onToggleVisibility={() => void onToggleVisibility(group.id)}
                            onRename={(label) => void onRename(group.id, label)}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
}

interface HeaderProps {
    readonly groupCount: number;
    readonly isSaving: boolean;
    readonly onReset: () => Promise<void>;
}

function Header({ groupCount, isSaving, onReset }: HeaderProps): React.JSX.Element {
    const [confirmReset, setConfirmReset] = useState(false);

    const handleReset = useCallback(() => {
        if (!confirmReset) {
            setConfirmReset(true);
            return;
        }
        setConfirmReset(false);
        void onReset();
    }, [confirmReset, onReset]);

    return (
        <header className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-[0.88rem] font-semibold text-[var(--text-1)]">Turns</span>
                    <Badge tone="neutral" size="xs">{groupCount} group{groupCount === 1 ? "" : "s"}</Badge>
                </div>
                <div className="flex items-center gap-1">
                    {confirmReset && (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                            Cancel
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant={confirmReset ? "destructive" : "ghost"}
                        onClick={handleReset}
                        disabled={isSaving}
                        title={confirmReset ? "Confirm reset to one group per turn" : "Reset to one group per turn"}
                    >
                        {confirmReset ? "Confirm reset?" : "Reset"}
                    </Button>
                </div>
            </div>
            <p className="m-0 text-[0.76rem] leading-relaxed text-[var(--text-2)]">
                Click a group to focus it on the timeline minimap. Hover a row to merge, split, hide, or rename.
            </p>
        </header>
    );
}

interface GroupRowProps {
    readonly group: TurnGroup;
    readonly isLast: boolean;
    readonly isFocused: boolean;
    readonly segmentMap: Map<number, TurnSegment>;
    readonly verdict: GroupVerdictSummary | null;
    readonly meta: GroupMeta | null;
    readonly isSaving: boolean;
    readonly onFocus: () => void;
    readonly onMergeNext: () => void;
    readonly onSplit: (atTurnIndex: number) => void;
    readonly onToggleVisibility: () => void;
    readonly onRename: (label: string | null) => void;
}

function GroupRow({
    group,
    isLast,
    isFocused,
    segmentMap,
    verdict,
    meta,
    isSaving,
    onFocus,
    onMergeNext,
    onSplit,
    onToggleVisibility,
    onRename,
}: GroupRowProps): React.JSX.Element {
    const canSplit = group.from < group.to;
    const canMerge = !isLast;
    const [renameOpen, setRenameOpen] = useState(false);
    const [renameValue, setRenameValue] = useState(group.label ?? "");
    const [splitOpen, setSplitOpen] = useState(false);

    const firstSegment = segmentMap.get(group.from);
    const preview = group.label?.trim() || firstSegment?.requestPreview || null;

    const handleRenameSubmit = useCallback(() => {
        const trimmed = renameValue.trim();
        onRename(trimmed ? trimmed : null);
        setRenameOpen(false);
    }, [onRename, renameValue]);

    const verdictBarClass = focusedBarClass(isFocused) ?? verdictBarClass_(verdict);

    return (
        <div
            data-focused={isFocused || undefined}
            className={cn(
                "group/turn-row relative overflow-hidden rounded-[var(--radius-md)] border bg-[var(--surface-2)] transition-colors",
                isFocused
                    ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent-light)_40%,var(--surface-2))]"
                    : "border-[var(--border)] hover:border-[var(--border-2)] hover:bg-[color-mix(in_srgb,var(--surface)_60%,var(--surface-2))]",
                !group.visible && "opacity-70",
            )}
        >
            <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-[3px]", verdictBarClass)} />
            <div className="flex items-start gap-2 pl-3 pr-2 py-2.5">
                <button
                    type="button"
                    onClick={onFocus}
                    className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left focus-visible:outline-none"
                    title={isFocused ? "Click again to keep focused (or use Clear focus above)" : "Focus this group on the timeline"}
                >
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[0.82rem] font-semibold text-[var(--text-1)]">
                            {scopeLabelForGroup(group)}
                        </span>
                        {!group.visible && <Badge tone="neutral" size="xs">hidden</Badge>}
                        {isFocused && <Badge tone="accent" size="xs">focused</Badge>}
                        {verdict?.status && <VerdictBadge status={verdict.status} />}
                        {!verdict?.status && verdict?.hasOpenTurn && <Badge tone="neutral" size="xs">open</Badge>}
                        {verdict && verdict.rulesEvaluatedCount > 0 && (
                            <Badge tone="neutral" size="xs">
                                {verdict.rulesEvaluatedCount} rule{verdict.rulesEvaluatedCount === 1 ? "" : "s"}
                            </Badge>
                        )}
                    </div>
                    {preview && (
                        <span className="line-clamp-1 w-full text-[0.74rem] text-[var(--text-3)] [overflow-wrap:anywhere]">
                            {preview}
                        </span>
                    )}
                    {meta && <MetaLine meta={meta} />}
                </button>
                <div
                    className={cn(
                        "flex shrink-0 items-center gap-1 transition-opacity",
                        isFocused
                            ? "opacity-100"
                            : "opacity-0 group-hover/turn-row:opacity-100 group-focus-within/turn-row:opacity-100",
                    )}
                >
                    {canSplit && (
                        <IconButton
                            label="Split"
                            onClick={() => setSplitOpen((v) => !v)}
                            disabled={isSaving}
                            active={splitOpen}
                        >
                            <ScissorsIcon />
                        </IconButton>
                    )}
                    {canMerge && (
                        <IconButton
                            label="Merge with next"
                            onClick={onMergeNext}
                            disabled={isSaving}
                        >
                            <MergeDownIcon />
                        </IconButton>
                    )}
                    <IconButton
                        label={group.visible ? "Hide in timeline" : "Show in timeline"}
                        onClick={onToggleVisibility}
                        disabled={isSaving}
                    >
                        {group.visible ? <EyeIcon /> : <EyeOffIcon />}
                    </IconButton>
                    <IconButton
                        label="Rename"
                        onClick={() => { setRenameValue(group.label ?? ""); setRenameOpen((v) => !v); }}
                        disabled={isSaving}
                        active={renameOpen}
                    >
                        <PencilIcon />
                    </IconButton>
                </div>
            </div>

            {renameOpen && (
                <div className="flex items-center gap-2 px-3 pb-2.5">
                    <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        placeholder="Custom label (optional)"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameSubmit();
                            if (e.key === "Escape") setRenameOpen(false);
                        }}
                    />
                    <Button size="sm" onClick={handleRenameSubmit} disabled={isSaving}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button>
                </div>
            )}

            {splitOpen && canSplit && (
                <div className="flex flex-wrap items-center gap-2 px-3 pb-2.5">
                    <span className="text-[0.72rem] text-[var(--text-3)]">Split before:</span>
                    {Array.from({ length: group.to - group.from }, (_, i) => group.from + i + 1).map((at) => (
                        <button
                            key={at}
                            type="button"
                            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.75 text-[0.72rem] font-semibold text-[var(--text-2)] hover:text-[var(--text-1)]"
                            onClick={() => { onSplit(at); setSplitOpen(false); }}
                            disabled={isSaving}
                        >
                            Turn {at}
                        </button>
                    ))}
                    <Button size="sm" variant="ghost" onClick={() => setSplitOpen(false)}>Cancel</Button>
                </div>
            )}
        </div>
    );
}

function MetaLine({ meta }: { readonly meta: GroupMeta }): React.JSX.Element {
    const parts: string[] = [];
    parts.push(`${meta.turnCount} turn${meta.turnCount === 1 ? "" : "s"}`);
    parts.push(`${meta.eventCount} event${meta.eventCount === 1 ? "" : "s"}`);
    if (meta.durationMs !== null && meta.durationMs > 0) {
        parts.push(formatDuration(meta.durationMs));
    }
    return (
        <span className="text-[0.7rem] text-[var(--text-3)]">
            {parts.join(" · ")}
        </span>
    );
}

function VerdictBadge({ status }: { readonly status: VerdictStatus }): React.JSX.Element {
    const tone = status === "verified" ? "success" : status === "contradicted" ? "danger" : "warning";
    const label = status === "verified" ? "verified" : status === "contradicted" ? "contradicted" : "unverifiable";
    return <Badge tone={tone} size="xs">{label}</Badge>;
}

interface IconButtonProps {
    readonly label: string;
    readonly onClick: () => void;
    readonly disabled?: boolean;
    readonly active?: boolean;
    readonly children: React.ReactNode;
}

function IconButton({ label, onClick, disabled, active, children }: IconButtonProps): React.JSX.Element {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border bg-[var(--surface)] text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
                active
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-[var(--border)] hover:border-[var(--border-2)]",
            )}
        >
            {children}
        </button>
    );
}

function LineIcon({ children, size = 14 }: { readonly children: React.ReactNode; readonly size?: number }): React.JSX.Element {
    return (
        <svg
            aria-hidden="true"
            fill="none"
            height={size}
            width={size}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
        >
            {children}
        </svg>
    );
}

function EyeIcon(): React.JSX.Element {
    return (
        <LineIcon>
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
        </LineIcon>
    );
}

function EyeOffIcon(): React.JSX.Element {
    return (
        <LineIcon>
            <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a15.9 15.9 0 0 1-3.24 3.9" />
            <path d="M6.61 6.6A15.9 15.9 0 0 0 2 11s3.5 7 10 7a10.95 10.95 0 0 0 5.39-1.4" />
            <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
            <line x1="2" y1="2" x2="22" y2="22" />
        </LineIcon>
    );
}

function PencilIcon(): React.JSX.Element {
    return (
        <LineIcon>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </LineIcon>
    );
}

function ScissorsIcon(): React.JSX.Element {
    return (
        <LineIcon>
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <line x1="20" y1="4" x2="8.12" y2="15.88" />
            <line x1="14.47" y1="14.48" x2="20" y2="20" />
            <line x1="8.12" y1="8.12" x2="12" y2="12" />
        </LineIcon>
    );
}

function MergeDownIcon(): React.JSX.Element {
    return (
        <LineIcon>
            <path d="M12 5v14" />
            <path d="M6 13l6 6 6-6" />
        </LineIcon>
    );
}

function EmptyState(): React.JSX.Element {
    return (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-6 text-center">
            <p className="m-0 text-[0.86rem] font-medium text-[var(--text-2)]">No turns yet</p>
            <p className="mt-1.5 mb-0 text-[0.78rem] text-[var(--text-3)]">
                Turns appear once the user sends at least one prompt.
            </p>
        </div>
    );
}

function computeGroupMeta(
    group: TurnGroup,
    timeline: readonly TimelineEventRecord[],
    segmentMap: Map<number, TurnSegment>,
): GroupMeta {
    const turnCount = group.to - group.from + 1;
    const events = filterEventsByGroup(timeline, group);
    const startSeg = segmentMap.get(group.from);
    const endSeg = segmentMap.get(group.to);
    const startMs = startSeg ? Date.parse(startSeg.startAt) : NaN;
    const endMs = endSeg ? Date.parse(endSeg.endAt) : NaN;
    const durationMs = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
        ? endMs - startMs
        : null;
    return { turnCount, eventCount: events.length, durationMs };
}

function focusedBarClass(isFocused: boolean): string | null {
    return isFocused ? "bg-[var(--accent)]" : null;
}

function verdictBarClass_(verdict: GroupVerdictSummary | null): string {
    if (!verdict?.status) {
        return verdict?.hasOpenTurn ? "bg-[var(--border-2)]" : "bg-transparent";
    }
    if (verdict.status === "verified") return "bg-[var(--ok)]";
    if (verdict.status === "contradicted") return "bg-[var(--err)]";
    return "bg-[var(--warn)]";
}
