import type React from "react";
import { type FormEvent as ReactFormEvent } from "react";
import { cn } from "../../lib/ui/cn.js";
import { Button } from "../../components/ui/Button.js";
import { OBSERVABILITY_BADGE_STYLES, TASK_STATUS_BUTTON_STYLES, formatTaskStatusLabel, type TimelineObservabilityStats } from "./utils.js";

export function TimelineTaskControlsPanel({ controlsPopoverRef, controlsPopoverPos, isEditingTaskTitle, onSubmitTitle, isSavingTaskTitle, onTitleDraftChange, taskTitleDraft, onCancelEditTitle, taskTitleError, onStartEditTitle, onOpenTaskWorkspace, taskStatus, onChangeTaskStatus, isUpdatingTaskStatus, observabilityStats }: {
    readonly controlsPopoverRef: React.RefObject<HTMLDivElement | null>;
    readonly controlsPopoverPos: {
        top: number;
        right: number;
    };
    readonly isEditingTaskTitle: boolean;
    readonly onSubmitTitle: (event: ReactFormEvent<HTMLFormElement>) => void;
    readonly isSavingTaskTitle: boolean;
    readonly onTitleDraftChange: (value: string) => void;
    readonly taskTitleDraft: string;
    readonly onCancelEditTitle: () => void;
    readonly taskTitleError: string | null;
    readonly onStartEditTitle: () => void;
    readonly onOpenTaskWorkspace: (() => void) | undefined;
    readonly taskStatus: "running" | "waiting" | "completed" | "errored" | undefined;
    readonly onChangeTaskStatus: ((status: "running" | "waiting" | "completed" | "errored") => void) | undefined;
    readonly isUpdatingTaskStatus: boolean | undefined;
    readonly observabilityStats: TimelineObservabilityStats;
}): React.JSX.Element {
    const observabilityBadges = [
        { key: "actions", label: "Actions", value: observabilityStats.actions },
        { key: "coordination", label: "Coordination", value: observabilityStats.coordinationActivities },
        { key: "files", label: "Files", value: observabilityStats.exploredFiles },
        { key: "compacts", label: "Compact", value: observabilityStats.compactions },
        { key: "checks", label: "Checks", value: observabilityStats.checks },
        { key: "violations", label: "Violations", value: observabilityStats.violations },
        { key: "passes", label: "Passes", value: observabilityStats.passes }
    ] as const;

    return (<div ref={controlsPopoverRef} className="timeline-task-controls-panel" style={{ position: "fixed", top: controlsPopoverPos.top, right: controlsPopoverPos.right, zIndex: 200, minWidth: 260 }}>
      <div className="timeline-popover-header">
        <span>Task controls</span>
        <span className="timeline-popover-summary">{taskStatus ? formatTaskStatusLabel(taskStatus) : "Task"}</span>
      </div>
      {isEditingTaskTitle ? (<form className="task-title-form" onSubmit={onSubmitTitle}>
          <div className="task-title-form-row">
            <input className="task-title-input" disabled={isSavingTaskTitle} onChange={(event) => onTitleDraftChange(event.target.value)} placeholder="Rename task" type="text" value={taskTitleDraft}/>
            <div className="task-title-actions">
              <Button variant="accent" className="h-8 px-3 text-[0.72rem] font-semibold shadow-none" disabled={isSavingTaskTitle} size="sm" type="submit">
                {isSavingTaskTitle ? "Saving..." : "Save"}
              </Button>
              <Button className="h-8 px-3 text-[0.72rem] font-semibold shadow-none" disabled={isSavingTaskTitle} onClick={onCancelEditTitle} size="sm" type="button">
                Cancel
              </Button>
            </div>
          </div>
          {taskTitleError && <p className="task-title-error">{taskTitleError}</p>}
        </form>) : (<div className="timeline-task-controls-row">
          <div className="timeline-title-actions">
            <Button className="h-8 px-3 text-[0.72rem] font-semibold shadow-none" onClick={onStartEditTitle} size="sm" type="button">
              Rename
            </Button>
            {onOpenTaskWorkspace && (<Button className="h-8 px-3 text-[0.72rem] font-semibold shadow-none" onClick={onOpenTaskWorkspace} size="sm" type="button">
                Workspace
              </Button>)}
          </div>
        </div>)}
      {!isEditingTaskTitle && taskStatus && onChangeTaskStatus && (<div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Status</span>
          <select className="h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[0.74rem] font-semibold text-[var(--text-2)] shadow-[var(--shadow-1)]" disabled={isUpdatingTaskStatus} onChange={(event) => onChangeTaskStatus(event.target.value as "running" | "waiting" | "completed" | "errored")} value={taskStatus}>
            {(["running", "waiting", "completed", "errored"] as const).map((status) => (<option key={status} value={status}>{formatTaskStatusLabel(status)}</option>))}
          </select>
        </div>)}
      <div className="timeline-task-badges">
        {observabilityBadges.map((badge) => (<div key={badge.key} className={cn("inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 text-[0.71rem] font-semibold tracking-[0.01em] shadow-[var(--shadow-1)]", OBSERVABILITY_BADGE_STYLES[badge.key])}>
            <span className="text-[0.78rem] font-bold leading-none">{badge.value}</span>
            <span className="leading-none">{badge.label}</span>
          </div>))}
      </div>
    </div>);
}
