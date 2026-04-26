import type React from "react";
import type { FormEvent as ReactFormEvent } from "react";
import type { buildTimelineContextSummary } from "~app/lib/timeline.js";
import { cn } from "~app/lib/ui/cn.js";
import { Button } from "~app/components/ui/Button.js";
import { TASK_STATUS_BUTTON_STYLES, formatTaskStatusLabel, type TimelineObservabilityStats } from "./status-styles.js";

export function TimelineContextBar({ taskTitle, taskUsesDerivedTitle, contextSummary, showRuleGapsOnly, onToggleRuleGap, selectedRuleId, onClearRuleId, observabilityStats, taskStatus, onChangeTaskStatus, isUpdatingTaskStatus, isEditingTaskTitle, taskTitleDraft, taskTitleError, isSavingTaskTitle, onTitleDraftChange, onSubmitTitle, onCancelEditTitle, onStartEditTitle, showInlineFiltersButton, isFiltersOpen, filtersButtonRef, setFiltersPopoverPos, setIsFiltersOpen, activeLaneCount, totalLaneCount, embedded }: {
    readonly taskTitle: string | null;
    readonly taskUsesDerivedTitle: boolean;
    readonly contextSummary: ReturnType<typeof buildTimelineContextSummary>;
    readonly showRuleGapsOnly: boolean;
    readonly onToggleRuleGap: (show: boolean) => void;
    readonly selectedRuleId: string | null;
    readonly onClearRuleId: () => void;
    readonly observabilityStats: TimelineObservabilityStats;
    readonly taskStatus?: "running" | "waiting" | "completed" | "errored" | undefined;
    readonly onChangeTaskStatus?: ((status: "running" | "waiting" | "completed" | "errored") => void) | undefined;
    readonly isUpdatingTaskStatus: boolean;
    readonly isEditingTaskTitle: boolean;
    readonly taskTitleDraft: string;
    readonly taskTitleError: string | null;
    readonly isSavingTaskTitle: boolean;
    readonly onTitleDraftChange: (value: string) => void;
    readonly onSubmitTitle: (event: ReactFormEvent<HTMLFormElement>) => void;
    readonly onCancelEditTitle: () => void;
    readonly onStartEditTitle: () => void;
    readonly showInlineFiltersButton: boolean;
    readonly isFiltersOpen: boolean;
    readonly filtersButtonRef: React.RefObject<HTMLButtonElement | null>;
    readonly setFiltersPopoverPos: (value: {
        top: number;
        right: number;
    }) => void;
    readonly setIsFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>;
    readonly activeLaneCount: number;
    readonly totalLaneCount: number;
    readonly embedded?: boolean;
}): React.JSX.Element {
    return (
        <div className="timeline-context-bar" style={{ position: "relative" }}>
            <div className="timeline-context-bar-main">
                <div className="timeline-context-copy">
                    {!embedded && (isEditingTaskTitle ? (
                        <form className="timeline-context-title-row flex-wrap gap-2" onSubmit={onSubmitTitle}>
                            <input
                                className="min-w-[18rem] flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[0.86rem] font-semibold text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
                                disabled={isSavingTaskTitle}
                                onChange={(event) => onTitleDraftChange(event.target.value)}
                                placeholder="Rename task"
                                type="text"
                                value={taskTitleDraft}
                            />
                            <div className="flex items-center gap-1.5">
                                <Button disabled={isSavingTaskTitle} size="sm" type="submit" variant="accent">
                                    {isSavingTaskTitle ? "Saving..." : "Save"}
                                </Button>
                                <Button disabled={isSavingTaskTitle} onClick={onCancelEditTitle} size="sm">
                                    Cancel
                                </Button>
                            </div>
                            {taskTitleError && <span className="basis-full text-[0.72rem] font-medium text-[var(--err)]">{taskTitleError}</span>}
                        </form>
                    ) : (
                        <div className="timeline-context-title-row">
                            <strong className="timeline-context-title">{taskTitle ?? "Waiting for task data…"}</strong>
                            <Button aria-label="Rename task" className="shrink-0 text-[var(--text-3)]" onClick={onStartEditTitle} size="icon" title="Rename task">
                                <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
                                    <path d="M12 20h9"/>
                                    <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                                </svg>
                            </Button>
                            {taskUsesDerivedTitle && taskTitle && <span className="timeline-context-summary-chip accent">Suggested</span>}
                        </div>
                    ))}
                    <div className="timeline-context-summary-row">
                        <span className="timeline-context-summary-chip">{contextSummary.eventSummary}</span>
                        {contextSummary.focusSummary && <span className="timeline-context-summary-chip emphasis">{contextSummary.focusSummary}</span>}
                        {showRuleGapsOnly && (
                            <button className="timeline-context-summary-chip emphasis" onClick={() => onToggleRuleGap(false)} type="button">
                                Gaps only ×
                            </button>
                        )}
                        {selectedRuleId && (
                            <button className="timeline-context-summary-chip emphasis" onClick={onClearRuleId} type="button">
                                Rule: {selectedRuleId} ×
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="timeline-context-bar-actions">
                {(observabilityStats.violations > 0 || observabilityStats.checks > 0) && (
                    <span className="timeline-context-summary-chip timeline-context-obs-stats" style={{ gap: 4, fontSize: "0.66rem" }}>
                        {observabilityStats.violations > 0 && <span style={{ color: "var(--err)" }}>{observabilityStats.violations}v</span>}
                        {observabilityStats.checks > 0 && <span>{observabilityStats.checks}c</span>}
                        {observabilityStats.passes > 0 && <span style={{ color: "var(--ok)" }}>{observabilityStats.passes}p</span>}
                    </span>
                )}

                {!embedded && taskStatus && (
                    <span className={cn("timeline-context-status", TASK_STATUS_BUTTON_STYLES[taskStatus].active)}>
                        {onChangeTaskStatus ? (
                            <span className="relative inline-flex items-center">
                                <span>{formatTaskStatusLabel(taskStatus)}</span>
                                <span className="ml-1 text-[0.58rem] opacity-70">v</span>
                                <select
                                    aria-label="Change task status"
                                    className="absolute inset-0 cursor-pointer opacity-0"
                                    disabled={isUpdatingTaskStatus}
                                    onChange={(event) => onChangeTaskStatus(event.target.value as "running" | "waiting" | "completed" | "errored")}
                                    value={taskStatus}
                                >
                                    {(["running", "waiting", "completed", "errored"] as const).map((status) => (
                                        <option key={status} value={status}>{formatTaskStatusLabel(status)}</option>
                                    ))}
                                </select>
                            </span>
                        ) : formatTaskStatusLabel(taskStatus)}
                    </span>
                )}

                {!embedded && showInlineFiltersButton && (
                    <button ref={filtersButtonRef} aria-expanded={isFiltersOpen} aria-label="Open filters and zoom" className={cn("timeline-context-toggle", isFiltersOpen && "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]")} onClick={() => {
                        if (filtersButtonRef.current) {
                            const rect = filtersButtonRef.current.getBoundingClientRect();
                            setFiltersPopoverPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                        }
                        setIsFiltersOpen((value) => !value);
                    }} title="Filters & Zoom" type="button">
                        <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
                            <line x1="4" x2="20" y1="6" y2="6"/><line x1="8" x2="16" y1="12" y2="12"/><line x1="11" x2="13" y1="18" y2="18"/>
                        </svg>
                        <span className="hidden text-[0.72rem] font-medium sm:inline">Filters</span>
                        {activeLaneCount < totalLaneCount && <span style={{ fontSize: "0.58rem", fontWeight: 700, lineHeight: 1 }}>{activeLaneCount}</span>}
                    </button>
                )}
            </div>
        </div>
    );
}
