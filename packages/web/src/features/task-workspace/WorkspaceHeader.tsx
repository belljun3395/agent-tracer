import type React from "react";
import { runtimeObservabilityLabel, runtimeTagLabel } from "../../components/TaskList.js";
import { Button } from "../../components/ui/Button.js";
import { cn } from "../../lib/ui/cn.js";
import type { WorkspaceState } from "./useWorkspace.js";

interface WorkspaceHeaderEmbeddedExtras {
    isEditingTaskTitle: boolean;
    isWorkspaceControlsOpen: boolean;
    isWorkspaceFiltersOpen: boolean;
    workspaceControlsButtonRef: React.RefObject<HTMLButtonElement | null>;
    workspaceFiltersButtonRef: React.RefObject<HTMLButtonElement | null>;
    onWorkspaceControlsToggle: () => void;
    onWorkspaceFiltersToggle: () => void;
}

interface WorkspaceHeaderProps {
    readonly embedded: boolean;
    readonly taskId: string;
    readonly workspace: Pick<WorkspaceState, "selectedTaskDetail" | "taskObservability" | "selectedTaskDisplayTitle" | "isEditingTaskTitle">;
    readonly isSubmittingRuleReview: boolean;
    readonly onRuleReview: (outcome: "approved" | "rejected" | "bypassed") => void;
    readonly onNavigateBack: () => void;
    readonly onNavigateDashboard: () => void;
    readonly embeddedExtras?: WorkspaceHeaderEmbeddedExtras | undefined;
}

export function WorkspaceHeader({
    embedded,
    taskId,
    workspace,
    isSubmittingRuleReview,
    onRuleReview,
    onNavigateBack,
    onNavigateDashboard,
    embeddedExtras,
}: WorkspaceHeaderProps): React.JSX.Element {
    const { selectedTaskDetail, taskObservability, selectedTaskDisplayTitle } = workspace;
    const ruleState = taskObservability?.observability.ruleEnforcement.activeState;

    const approvalButtons = (
        <>
            {ruleState === "approval_required" && (
                <Button size="sm" variant="accent" disabled={isSubmittingRuleReview}
                    onClick={() => onRuleReview("approved")}>Approve</Button>
            )}
            {(ruleState === "approval_required" || ruleState === "blocked") && (
                <Button size="sm" variant="destructive" disabled={isSubmittingRuleReview}
                    onClick={() => onRuleReview("rejected")}>Reject</Button>
            )}
            {(ruleState === "approval_required" || ruleState === "blocked") && (
                <Button size="sm" disabled={isSubmittingRuleReview}
                    onClick={() => onRuleReview("bypassed")}>Bypass</Button>
            )}
        </>
    );

    if (embedded && embeddedExtras) {
        const { isEditingTaskTitle, isWorkspaceControlsOpen, isWorkspaceFiltersOpen,
            workspaceControlsButtonRef, workspaceFiltersButtonRef,
            onWorkspaceControlsToggle, onWorkspaceFiltersToggle } = embeddedExtras;

        return (
            <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3">
                <div className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden">
                    <button aria-label="Back to task list" type="button"
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)] transition-colors hover:border-[color-mix(in_srgb,var(--accent)_36%,var(--border))] hover:text-[var(--text-2)]"
                        onClick={onNavigateBack} title="Back to task list">
                        <svg aria-hidden="true" fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="12">
                            <polyline points="15 18 9 12 15 6"/>
                        </svg>
                    </button>
                    <span className="truncate text-[0.88rem] font-semibold text-[var(--text-1)]">
                        {selectedTaskDisplayTitle ?? selectedTaskDetail?.task.title ?? taskId}
                    </span>
                    {selectedTaskDetail?.task && (
                        <span className={cn("inline-flex shrink-0 items-center rounded-[var(--radius-md)] border px-2 py-0.5 text-[0.64rem] font-semibold uppercase tracking-[0.06em]",
                            selectedTaskDetail.task.status === "running" ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
                            : selectedTaskDetail.task.status === "waiting" ? "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]"
                            : selectedTaskDetail.task.status === "completed" ? "border-[var(--accent-light)] bg-[var(--accent-light)] text-[var(--accent)]"
                            : "border-[var(--err-bg)] bg-[var(--err-bg)] text-[var(--err)]")}>
                            {selectedTaskDetail.task.status}
                        </span>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    <button ref={workspaceControlsButtonRef} type="button"
                        aria-expanded={isWorkspaceControlsOpen || isEditingTaskTitle}
                        aria-label="Open task controls"
                        className={cn("timeline-context-toggle", (isWorkspaceControlsOpen || isEditingTaskTitle) && "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]")}
                        onClick={onWorkspaceControlsToggle} title="Task controls">
                        <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
                            <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                        </svg>
                        <span className="hidden text-[0.72rem] font-medium sm:inline">Controls</span>
                    </button>
                    <button ref={workspaceFiltersButtonRef} type="button"
                        aria-expanded={isWorkspaceFiltersOpen}
                        aria-label="Open filters and zoom"
                        className={cn("timeline-context-toggle", isWorkspaceFiltersOpen && "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]")}
                        onClick={onWorkspaceFiltersToggle} title="Filters & Zoom">
                        <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
                            <line x1="4" x2="20" y1="6" y2="6"/><line x1="8" x2="16" y1="12" y2="12"/><line x1="11" x2="13" y1="18" y2="18"/>
                        </svg>
                        <span className="hidden text-[0.72rem] font-medium sm:inline">Filters</span>
                    </button>
                    {approvalButtons}
                </div>
            </header>
        );
    }

    return (
        <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,var(--bg))] px-4 py-2.5 shadow-[var(--shadow-1)]">
            <div className="min-w-0">
                <p className="m-0 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Task Workspace</p>
                <h1 className="mt-1 break-words text-[0.96rem] leading-tight font-semibold tracking-[-0.02em] text-[var(--text-1)] sm:truncate">
                    {selectedTaskDisplayTitle ?? selectedTaskDetail?.task.title ?? taskId}
                </h1>
                {selectedTaskDetail?.task && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.72rem]">
                        {selectedTaskDetail.task.runtimeSource && (
                            <span className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-semibold text-[var(--text-2)] shadow-[var(--shadow-1)]">
                                {runtimeTagLabel(selectedTaskDetail.task.runtimeSource)}
                            </span>
                        )}
                        <span className={cn("inline-flex items-center rounded-[var(--radius-md)] border px-2.5 py-1 font-semibold uppercase tracking-[0.06em]",
                            selectedTaskDetail.task.status === "running" ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
                            : selectedTaskDetail.task.status === "waiting" ? "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)]"
                            : selectedTaskDetail.task.status === "completed" ? "border-[var(--accent-light)] bg-[var(--accent-light)] text-[var(--accent)]"
                            : "border-[var(--err-bg)] bg-[var(--err-bg)] text-[var(--err)]")}>
                            {selectedTaskDetail.task.status}
                        </span>
                        {runtimeObservabilityLabel(selectedTaskDetail.task.runtimeSource) && (
                            <span className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--warn-bg)] bg-[var(--warn-bg)] px-2.5 py-1 font-semibold text-[var(--warn)]">
                                {runtimeObservabilityLabel(selectedTaskDetail.task.runtimeSource)}
                            </span>
                        )}
                        {ruleState === "approval_required" && selectedTaskDetail.task.status === "waiting" && (
                            <span className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--accent-light)] bg-[var(--accent-light)] px-2.5 py-1 font-semibold text-[var(--accent)]">
                                {taskObservability?.observability.ruleEnforcement.activeLabel
                                    ? `approval required · ${taskObservability.observability.ruleEnforcement.activeLabel}`
                                    : "approval required"}
                            </span>
                        )}
                        {ruleState === "blocked" && selectedTaskDetail.task.status === "errored" && (
                            <span className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--err-bg)] bg-[var(--err-bg)] px-2.5 py-1 font-semibold text-[var(--err)]">
                                {taskObservability?.observability.ruleEnforcement.activeLabel
                                    ? `blocked by rule · ${taskObservability.observability.ruleEnforcement.activeLabel}`
                                    : "blocked by rule"}
                            </span>
                        )}
                    </div>
                )}
                {selectedTaskDetail?.task.workspacePath && (
                    <p className="mt-1 break-all font-mono text-[0.74rem] text-[var(--text-3)] sm:truncate">
                        {selectedTaskDetail.task.workspacePath}
                    </p>
                )}
            </div>
            <div className="grid w-full shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap lg:justify-end">
                {approvalButtons}
                <Button size="sm" onClick={onNavigateDashboard}>Dashboard</Button>
            </div>
        </header>
    );
}
