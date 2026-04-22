import type React from "react";
import { useCallback, useMemo, useState } from "react";
import {
    buildAgentTrace,
    buildEvaluatePrompt,
    buildReusableTaskSnapshot,
    buildTaskExtraction,
    collectFileActivity,
    collectViolationDescriptions,
    filterEventsByGroup,
    scopeKeyForGroup,
    scopeLabelForGroup,
    segmentEventsByTurn,
    type ReusableTaskSnapshot,
    type TimelineEventRecord,
    type TurnGroup,
    type TurnPartition,
} from "../../../types.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { Eyebrow } from "../ui/Eyebrow.js";
import { Input } from "../ui/Input.js";
import { Textarea } from "../ui/Textarea.js";
import { cn } from "../../lib/ui/cn.js";
import { copyToClipboard } from "../../lib/ui/clipboard.js";

export interface TurnsTabProps {
    readonly taskId: string | undefined;
    readonly taskTitle: string;
    readonly taskTimeline: readonly TimelineEventRecord[];
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

export function TurnsTab({
    taskId,
    taskTitle,
    taskTimeline,
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
        const map = new Map<number, (typeof segments)[number]>();
        for (const s of segments) map.set(s.turnIndex, s);
        return map;
    }, [segments]);

    const groups = partition?.groups ?? [];
    const focusedGroup = groups.find((g) => g.id === focusedGroupId) ?? null;

    if (!partition || groups.length === 0) {
        return (
            <div className="panel-tab-inner flex flex-col gap-4 p-4">
                <EmptyState />
            </div>
        );
    }

    return (
        <div className="panel-tab-inner flex flex-col gap-4 p-4">
            <header className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[0.88rem] font-semibold text-[var(--text-1)]">Turns</span>
                        <Badge tone="neutral" size="xs">{groups.length} group{groups.length === 1 ? "" : "s"}</Badge>
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void onReset()}
                        disabled={isSaving}
                        title="Reset to one group per turn"
                    >
                        Reset
                    </Button>
                </div>
                <p className="m-0 text-[0.76rem] leading-relaxed text-[var(--text-2)]">
                    Merge adjacent turns, split multi-turn groups, and toggle which ranges are visible in the timeline.
                    Copy a group for AI evaluation below.
                </p>
            </header>

            <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <Eyebrow>Groups</Eyebrow>
                    <button
                        type="button"
                        className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text-1)]"
                        onClick={() => onFocusGroup(null)}
                    >
                        {focusedGroupId === null ? "Focused: none" : "Clear focus"}
                    </button>
                </div>
                <div className="flex flex-col gap-2">
                    {groups.map((group, index) => (
                        <GroupRow
                            key={group.id}
                            group={group}
                            isFirst={index === 0}
                            isLast={index === groups.length - 1}
                            isFocused={group.id === focusedGroupId}
                            segmentMap={segmentMap}
                            isSaving={isSaving}
                            onFocus={() => onFocusGroup(group.id === focusedGroupId ? null : group.id)}
                            onMergeNext={() => void onMergeNext(group.id)}
                            onSplit={(at) => void onSplit(group.id, at)}
                            onToggleVisibility={() => void onToggleVisibility(group.id)}
                            onRename={(label) => void onRename(group.id, label)}
                        />
                    ))}
                </div>
            </section>

            {focusedGroup && (
                <FocusedGroupPanel
                    taskId={taskId}
                    taskTitle={taskTitle}
                    taskTimeline={taskTimeline}
                    group={focusedGroup}
                />
            )}
        </div>
    );
}

interface GroupRowProps {
    readonly group: TurnGroup;
    readonly isFirst: boolean;
    readonly isLast: boolean;
    readonly isFocused: boolean;
    readonly segmentMap: Map<number, { readonly turnIndex: number; readonly requestPreview: string | null }>;
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

    return (
        <div
            className={cn(
                "rounded-[var(--radius-md)] border bg-[var(--surface-2)] px-3 py-2.5 transition-colors",
                isFocused
                    ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent-light)_40%,var(--surface-2))]"
                    : "border-[var(--border)]",
                !group.visible && "opacity-70",
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <button
                    type="button"
                    onClick={onFocus}
                    className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
                    title="Focus this group"
                >
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.82rem] font-semibold text-[var(--text-1)]">
                            {scopeLabelForGroup(group)}
                        </span>
                        {!group.visible && <Badge tone="neutral" size="xs">hidden</Badge>}
                        {isFocused && <Badge tone="accent" size="xs">focused</Badge>}
                    </div>
                    {preview && (
                        <span className="line-clamp-1 w-full text-[0.74rem] text-[var(--text-3)] [overflow-wrap:anywhere]">
                            {preview}
                        </span>
                    )}
                </button>
                <div className="flex shrink-0 items-center gap-1">
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
                    >
                        <PencilIcon />
                    </IconButton>
                    {canSplit && (
                        <IconButton
                            label="Split"
                            onClick={() => setSplitOpen((v) => !v)}
                            disabled={isSaving}
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
                </div>
            </div>

            {renameOpen && (
                <div className="mt-2 flex items-center gap-2">
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
                <div className="mt-2 flex flex-wrap items-center gap-2">
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

function IconButton({
    label,
    onClick,
    disabled,
    children,
}: {
    readonly label: string;
    readonly onClick: () => void;
    readonly disabled?: boolean;
    readonly children: React.ReactNode;
}): React.JSX.Element {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] transition-colors hover:border-[var(--border-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
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

function FocusedGroupPanel({
    taskId,
    taskTitle,
    taskTimeline,
    group,
}: {
    readonly taskId: string | undefined;
    readonly taskTitle: string;
    readonly taskTimeline: readonly TimelineEventRecord[];
    readonly group: TurnGroup;
}): React.JSX.Element {
    const [copied, setCopied] = useState(false);
    const [rating, setRating] = useState<"good" | "skip" | null>(null);
    const [useCase, setUseCase] = useState("");
    const [outcomeNote, setOutcomeNote] = useState("");

    const scopedEvents = useMemo(() => filterEventsByGroup(taskTimeline, group), [taskTimeline, group]);
    const extraction = useMemo(() => buildTaskExtraction(undefined, scopedEvents, []), [scopedEvents]);
    const snapshot = useMemo<ReusableTaskSnapshot>(
        () => buildReusableTaskSnapshot({ objective: extraction.objective || taskTitle, events: scopedEvents }),
        [extraction.objective, scopedEvents, taskTitle],
    );
    const agentTrace = useMemo(() => buildAgentTrace(scopedEvents), [scopedEvents]);
    const modifiedFiles = useMemo(
        () => collectFileActivity(scopedEvents).filter((f) => f.writeCount > 0).map((f) => f.path),
        [scopedEvents],
    );
    const violations = useMemo(() => collectViolationDescriptions(scopedEvents), [scopedEvents]);
    const scopeKey = useMemo(() => scopeKeyForGroup(group), [group]);

    const handleCopy = useCallback(() => {
        const prompt = buildEvaluatePrompt({
            taskId: taskId ?? "",
            objective: extraction.objective || taskTitle,
            modifiedFiles,
            violations,
            snapshot,
            agentTrace,
            userAssessment: {
                ...(rating ? { rating } : {}),
                ...(useCase.trim() ? { useCase: useCase.trim() } : {}),
                ...(outcomeNote.trim() ? { outcomeNote: outcomeNote.trim() } : {}),
            },
        });
        void copyToClipboard(prompt).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [agentTrace, extraction.objective, modifiedFiles, outcomeNote, rating, snapshot, taskId, taskTitle, useCase, violations]);

    return (
        <section className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
            <header className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.82rem] font-semibold text-[var(--text-1)]">Preview · {scopeLabelForGroup(group)}</span>
                    <Badge tone="neutral" size="xs" title="Evaluation scope key">{scopeKey}</Badge>
                </div>
                <span className="text-[0.7rem] text-[var(--text-3)]">{scopedEvents.length} event{scopedEvents.length === 1 ? "" : "s"}</span>
            </header>

            <SnapshotPreview snapshot={snapshot} />

            <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <FieldLabel>Worth reusing?</FieldLabel>
                    <div className="flex gap-2">
                        <RatingButton active={rating === "good"} onClick={() => setRating("good")}>Reuse</RatingButton>
                        <RatingButton active={rating === "skip"} onClick={() => setRating("skip")}>Skip</RatingButton>
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <FieldLabel>Use case</FieldLabel>
                    <Input
                        placeholder="e.g. TypeScript error fix"
                        value={useCase}
                        onChange={(e) => setUseCase(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <FieldLabel>Outcome note</FieldLabel>
                <Textarea
                    rows={2}
                    placeholder="What was resolved in this group? (optional)"
                    value={outcomeNote}
                    onChange={(e) => setOutcomeNote(e.target.value)}
                />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="flex items-center gap-1.5 text-[0.72rem] text-[var(--text-3)]">
                    <span className="rounded-[4px] bg-[var(--surface)] px-1.5 py-0.5">Copy</span>
                    <span>→</span>
                    <span className="rounded-[4px] bg-[var(--surface)] px-1.5 py-0.5">Paste to Claude</span>
                    <span>→</span>
                    <span className="rounded-[4px] bg-[var(--surface)] px-1.5 py-0.5">Evaluated @ {scopeKey}</span>
                </div>
                <button
                    type="button"
                    className={cn(
                        "shrink-0 rounded-[7px] border px-3 py-1.5 text-[0.78rem] font-semibold transition-all",
                        copied
                            ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
                            : "border-[var(--accent)] bg-[var(--accent)] text-[#fff] hover:opacity-90",
                    )}
                    onClick={handleCopy}
                    disabled={!taskId}
                >
                    {copied ? "Copied ✓" : "Copy for AI"}
                </button>
            </div>
        </section>
    );
}

function SnapshotPreview({ snapshot }: { readonly snapshot: ReusableTaskSnapshot }): React.JSX.Element {
    return (
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
            {snapshot.objective && <PreviewField label="Objective" value={snapshot.objective} />}
            {snapshot.outcomeSummary && <PreviewField label="Outcome" value={snapshot.outcomeSummary} />}
            {snapshot.modifiedFiles.length > 0 && <PreviewList label="Modified files" items={snapshot.modifiedFiles} />}
            {snapshot.keyFiles.length > 0 && <PreviewList label="Key files" items={snapshot.keyFiles} />}
            {snapshot.verificationSummary && <PreviewField label="Verification" value={snapshot.verificationSummary} />}
            {snapshot.nextSteps.length > 0 && <PreviewList label="Next steps" items={snapshot.nextSteps} />}
        </div>
    );
}

function PreviewField({ label, value }: { readonly label: string; readonly value: string }): React.JSX.Element {
    return (
        <div className="flex flex-col gap-1">
            <Eyebrow>{label}</Eyebrow>
            <p className="m-0 text-[0.78rem] leading-6 text-[var(--text-2)] [overflow-wrap:anywhere]">{value}</p>
        </div>
    );
}

function PreviewList({ label, items }: { readonly label: string; readonly items: readonly string[] }): React.JSX.Element {
    return (
        <div className="flex flex-col gap-1">
            <Eyebrow>{label}</Eyebrow>
            <div className="flex flex-col gap-0.5">
                {items.slice(0, 6).map((item) => (
                    <p key={item} className="m-0 text-[0.78rem] leading-6 text-[var(--text-2)] [overflow-wrap:anywhere]">- {item}</p>
                ))}
                {items.length > 6 && (
                    <p className="m-0 text-[0.72rem] text-[var(--text-3)]">+{items.length - 6} more</p>
                )}
            </div>
        </div>
    );
}

function FieldLabel({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
    return <Eyebrow className="text-[0.68rem] tracking-[0.06em]">{children}</Eyebrow>;
}

function RatingButton({
    active,
    children,
    onClick,
}: {
    readonly active: boolean;
    readonly children: React.ReactNode;
    readonly onClick: () => void;
}): React.JSX.Element {
    return (
        <button
            type="button"
            className={cn(
                "rounded-[var(--radius-md)] border px-2.5 py-1.25 text-[0.74rem] font-semibold transition-colors",
                active
                    ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
                    : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text-1)]",
            )}
            onClick={onClick}
        >
            {children}
        </button>
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
