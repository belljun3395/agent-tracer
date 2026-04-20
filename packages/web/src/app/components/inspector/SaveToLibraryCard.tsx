import type React from "react";
import { useCallback, useMemo, useState } from "react";
import {
    buildReusableTaskSnapshot,
    buildEvaluatePrompt,
    buildAgentTrace,
    filterEventsByTurnRange,
    segmentEventsByTurn,
    type ReusableTaskSnapshot,
} from "../../../types.js";
import {
    buildTaskExtraction,
    collectViolationDescriptions,
    type TaskExtraction,
    type TimelineEventRecord,
} from "../../../types.js";
import { Badge } from "../ui/Badge.js";
import { Input } from "../ui/Input.js";
import { Textarea } from "../ui/Textarea.js";
import { Eyebrow } from "../ui/Eyebrow.js";
import { cn } from "../../lib/ui/cn.js";
import { copyToClipboard } from "../../lib/ui/clipboard.js";

type TurnRangeSelection =
    | { readonly kind: "all" }
    | { readonly kind: "turn"; readonly turnIndex: number }
    | { readonly kind: "last" };


export interface SaveToLibraryCardProps {
    readonly taskId: string;
    readonly taskTitle: string;
    readonly taskExtraction: TaskExtraction;
    readonly taskTimeline: readonly TimelineEventRecord[];
    readonly handoffModifiedFiles: readonly string[];
    readonly handoffViolations: readonly string[];
    readonly handoffSnapshot: ReusableTaskSnapshot;
}

export function SaveToLibraryCard({
    taskId,
    taskTitle,
    taskExtraction,
    taskTimeline,
    handoffModifiedFiles,
    handoffViolations,
    handoffSnapshot,
}: SaveToLibraryCardProps): React.JSX.Element {
    const [selection, setSelection] = useState<TurnRangeSelection>({ kind: "all" });
    const [rating, setRating] = useState<"good" | "skip" | null>(null);
    const [useCase, setUseCase] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [outcomeNote, setOutcomeNote] = useState("");
    const [approachNote, setApproachNote] = useState("");
    const [reuseWhen, setReuseWhen] = useState("");
    const [watchouts, setWatchouts] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [copied, setCopied] = useState(false);

    const segments = useMemo(() => segmentEventsByTurn(taskTimeline), [taskTimeline]);
    const selectableTurns = useMemo(() => segments.filter((s) => !s.isPrelude), [segments]);
    const hasMultipleTurns = selectableTurns.length > 1;

    const turnRange = useMemo(() => {
        if (selection.kind === "all") return { from: null as number | null, to: null as number | null };
        if (selection.kind === "turn") return { from: selection.turnIndex, to: selection.turnIndex };
        const last = selectableTurns[selectableTurns.length - 1];
        const lastIndex = last?.turnIndex ?? null;
        return { from: lastIndex, to: lastIndex };
    }, [selectableTurns, selection]);

    const scopedTimeline = useMemo(
        () => filterEventsByTurnRange(taskTimeline, turnRange),
        [taskTimeline, turnRange],
    );

    const scopedSnapshot = useMemo<ReusableTaskSnapshot>(() => {
        if (selection.kind === "all") return handoffSnapshot;
        return buildReusableTaskSnapshot({
            objective: taskExtraction.objective || taskTitle,
            events: scopedTimeline,
        });
    }, [handoffSnapshot, scopedTimeline, selection.kind, taskExtraction.objective, taskTitle]);

    const selectionLabel = useMemo(() => {
        if (selection.kind === "all") return "Whole task";
        if (selection.kind === "turn") return `Turn ${selection.turnIndex}`;
        return "Last turn";
    }, [selection]);

    const scopedExtraction = useMemo(
        () => buildTaskExtraction(undefined, scopedTimeline, []),
        [scopedTimeline],
    );
    const scopedHandoffViolations = useMemo(() => collectViolationDescriptions(scopedTimeline), [scopedTimeline]);
    const scopedModifiedFiles = useMemo(() => scopedSnapshot.modifiedFiles, [scopedSnapshot]);
    const agentTrace = useMemo(() => buildAgentTrace(scopedTimeline), [scopedTimeline]);

    const addTag = useCallback((raw: string) => {
        const cleaned = raw.trim().replace(/,+$/, "").trim();
        if (cleaned && !tags.includes(cleaned)) setTags((prev) => [...prev, cleaned]);
        setTagInput("");
    }, [tags]);

    const handleTagKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "," || event.key === "Enter") {
            event.preventDefault();
            addTag(tagInput);
        } else if (event.key === "Backspace" && tagInput === "" && tags.length > 0) {
            setTags((prev) => prev.slice(0, -1));
        }
    }, [addTag, tagInput, tags.length]);

    const handleTagBlur = useCallback(() => {
        if (tagInput.trim()) addTag(tagInput);
    }, [addTag, tagInput]);

    const removeTag = useCallback((tag: string) => {
        setTags((prev) => prev.filter((t) => t !== tag));
    }, []);

    const handleCopyPrompt = useCallback(() => {
        const isAll = selection.kind === "all";
        const prompt = buildEvaluatePrompt({
            taskId,
            objective: scopedExtraction.objective || taskTitle,
            modifiedFiles: isAll ? handoffModifiedFiles : scopedModifiedFiles,
            violations: isAll ? handoffViolations : scopedHandoffViolations,
            snapshot: scopedSnapshot,
            agentTrace,
            userAssessment: {
                ...(rating ? { rating } : {}),
                ...(useCase.trim() ? { useCase: useCase.trim() } : {}),
                ...(tags.length > 0 ? { workflowTags: tags } : {}),
                ...(outcomeNote.trim() ? { outcomeNote: outcomeNote.trim() } : {}),
                ...(approachNote.trim() ? { approachNote: approachNote.trim() } : {}),
                ...(reuseWhen.trim() ? { reuseWhen: reuseWhen.trim() } : {}),
                ...(watchouts.trim() ? { watchouts: watchouts.trim() } : {}),
            },
        });
        void copyToClipboard(prompt).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [
        taskId, selection.kind, scopedExtraction, taskTitle,
        handoffModifiedFiles, handoffViolations,
        scopedModifiedFiles, scopedHandoffViolations,
        scopedSnapshot, agentTrace,
        rating, useCase, tags, outcomeNote, approachNote, reuseWhen, watchouts,
    ]);

    return (
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
            <header className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[0.88rem] font-semibold text-[var(--text-1)]">Save to Library</span>
                        <Badge tone="accent" size="xs">via Claude</Badge>
                    </div>
                    <span className="text-[0.7rem] text-[var(--text-3)]">{selectionLabel}</span>
                </div>
                <p className="m-0 text-[0.76rem] leading-relaxed text-[var(--text-2)]">
                    Fill in what you know — leave the rest empty. Copy the prompt and paste it to Claude to save automatically.
                </p>
            </header>

            {hasMultipleTurns && (
                <div className="flex flex-col gap-1.5">
                    <span className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">
                        Turn range
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        <TurnChip
                            active={selection.kind === "all"}
                            onClick={() => setSelection({ kind: "all" })}
                        >
                            All ({selectableTurns.length})
                        </TurnChip>
                        <TurnChip
                            active={selection.kind === "last"}
                            onClick={() => setSelection({ kind: "last" })}
                        >
                            Last
                        </TurnChip>
                        {selectableTurns.map((segment) => (
                            <TurnChip
                                key={segment.turnIndex}
                                active={selection.kind === "turn" && selection.turnIndex === segment.turnIndex}
                                onClick={() => setSelection({ kind: "turn", turnIndex: segment.turnIndex })}
                                title={segment.requestPreview ?? undefined}
                            >
                                Turn {segment.turnIndex}
                            </TurnChip>
                        ))}
                    </div>
                </div>
            )}

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
                    placeholder="What kind of task? e.g. TypeScript type error fix"
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value)}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <FieldLabel>Tags</FieldLabel>
                <div className="flex flex-wrap gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 focus-within:border-[var(--accent)]">
                    {tags.map((tag) => (
                        <span
                            key={tag}
                            className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 text-[0.68rem] text-[var(--accent)]"
                        >
                            {tag}
                            <button type="button" className="hover:text-[var(--text-1)]" onClick={() => removeTag(tag)}>×</button>
                        </span>
                    ))}
                    <input
                        className="min-w-[80px] flex-1 bg-transparent text-[0.78rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)]"
                        placeholder={tags.length === 0 ? "typescript, bug-fix, refactor…" : ""}
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        onBlur={handleTagBlur}
                    />
                </div>
            </div>

            <TextareaField
                label="Outcome"
                placeholder="What was resolved? (optional — agent will infer)"
                rows={2}
                value={outcomeNote}
                onChange={setOutcomeNote}
            />
            <TextareaField
                label="What worked"
                placeholder="What approach or pattern worked well? (optional)"
                rows={2}
                value={approachNote}
                onChange={setApproachNote}
            />
            <TextareaField
                label="Reuse when"
                placeholder="When should this be reused? (optional)"
                rows={2}
                value={reuseWhen}
                onChange={setReuseWhen}
            />
            <TextareaField
                label="Watch out"
                placeholder="Anything to be careful about? (optional)"
                rows={2}
                value={watchouts}
                onChange={setWatchouts}
            />

            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="flex items-center gap-1.5 text-[0.72rem] text-[var(--text-3)]">
                    <span className="rounded-[4px] bg-[var(--surface)] px-1.5 py-0.5">Copy</span>
                    <span>→</span>
                    <span className="rounded-[4px] bg-[var(--surface)] px-1.5 py-0.5">Paste to Claude</span>
                    <span>→</span>
                    <span className="rounded-[4px] bg-[var(--surface)] px-1.5 py-0.5">Auto-saved</span>
                </div>
                <button
                    type="button"
                    className={cn(
                        "shrink-0 rounded-[7px] border px-3 py-1.5 text-[0.78rem] font-semibold transition-all",
                        copied
                            ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
                            : "border-[var(--accent)] bg-[var(--accent)] text-[#fff] hover:opacity-90",
                    )}
                    onClick={handleCopyPrompt}
                >
                    {copied ? "Copied ✓" : "Copy Prompt"}
                </button>
            </div>

            <div className="flex flex-col gap-2">
                <button
                    type="button"
                    className="flex items-center gap-1.5 self-start text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text-1)]"
                    onClick={() => setShowAdvanced((v) => !v)}
                >
                    <span>{showAdvanced ? "▾" : "▸"}</span>
                    <span>Advanced — snapshot preview</span>
                </button>
                {showAdvanced && <SnapshotPreview snapshot={scopedSnapshot} />}
            </div>

        </section>
    );
}

function SnapshotPreview({ snapshot }: { readonly snapshot: ReusableTaskSnapshot }): React.JSX.Element {
    return (
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <p className="m-0 text-[0.7rem] leading-relaxed text-[var(--text-3)]">
                Auto-generated from task activity. The agent will refine this using your assessment above.
            </p>
            <div className="flex flex-col gap-2">
                {snapshot.objective && <PreviewField label="Objective" value={snapshot.objective} />}
                {snapshot.modifiedFiles.length > 0 && <PreviewList label="Modified files" items={snapshot.modifiedFiles} />}
                {snapshot.keyFiles.length > 0 && <PreviewList label="Key files" items={snapshot.keyFiles} />}
                {snapshot.verificationSummary && <PreviewField label="Verification" value={snapshot.verificationSummary} />}
            </div>
        </div>
    );
}

function PreviewField({ label, value }: { readonly label: string; readonly value: string }): React.JSX.Element {
    return (
        <div className="flex flex-col gap-1">
            <Eyebrow>{label}</Eyebrow>
            <p className="m-0 text-[0.78rem] leading-6 text-[var(--text-2)]">{value}</p>
        </div>
    );
}

function PreviewList({ label, items }: { readonly label: string; readonly items: readonly string[] }): React.JSX.Element {
    return (
        <div className="flex flex-col gap-1">
            <Eyebrow>{label}</Eyebrow>
            <div className="flex flex-col gap-0.5">
                {items.map((item) => (
                    <p key={item} className="m-0 text-[0.78rem] leading-6 text-[var(--text-2)]">- {item}</p>
                ))}
            </div>
        </div>
    );
}

function FieldLabel({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
    return (
        <Eyebrow className="text-[0.68rem] tracking-[0.06em]">{children}</Eyebrow>
    );
}

function TextareaField({
    label,
    value,
    rows,
    placeholder,
    onChange,
}: {
    readonly label: string;
    readonly value: string;
    readonly rows: number;
    readonly placeholder?: string;
    readonly onChange: (value: string) => void;
}): React.JSX.Element {
    return (
        <div className="flex flex-col gap-1.5">
            <FieldLabel>{label}</FieldLabel>
            <Textarea
                className="resize-y"
                placeholder={placeholder}
                rows={rows}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}

function TurnChip({
    active,
    children,
    onClick,
    title,
}: {
    readonly active: boolean;
    readonly children: React.ReactNode;
    readonly onClick: () => void;
    readonly title?: string | undefined;
}): React.JSX.Element {
    return (
        <button
            type="button"
            title={title}
            className={cn(
                "rounded-[999px] border px-2.5 py-1 text-[0.72rem] font-semibold transition-colors",
                active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[#fff]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text-1)]",
            )}
            onClick={onClick}
        >
            {children}
        </button>
    );
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
