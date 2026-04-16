import type React from "react";
import { type buildTimelineContextSummary } from "@monitor/web-domain";
import { cn } from "../../lib/ui/cn.js";
import { TASK_STATUS_BUTTON_STYLES, type TimelineObservabilityStats } from "./utils.js";

export function TimelineContextBar({ taskTitle, taskUsesDerivedTitle, contextSummary, showRuleGapsOnly, onToggleRuleGap, selectedRuleId, onClearRuleId, selectedTag, onClearTag, observabilityStats, taskStatus, isTaskControlsOpen, isEditingTaskTitle, controlsButtonRef, setControlsPopoverPos, setIsTaskControlsOpen, isFiltersOpen, filtersButtonRef, setFiltersPopoverPos, setIsFiltersOpen, activeLaneCount, totalLaneCount, embedded }: {
    readonly taskTitle: string | null;
    readonly taskUsesDerivedTitle: boolean;
    readonly contextSummary: ReturnType<typeof buildTimelineContextSummary>;
    readonly showRuleGapsOnly: boolean;
    readonly onToggleRuleGap: (show: boolean) => void;
    readonly selectedRuleId: string | null;
    readonly onClearRuleId: () => void;
    readonly selectedTag: string | null;
    readonly onClearTag: () => void;
    readonly observabilityStats: TimelineObservabilityStats;
    readonly taskStatus?: "running" | "waiting" | "completed" | "errored" | undefined;
    readonly isTaskControlsOpen: boolean;
    readonly isEditingTaskTitle: boolean;
    readonly controlsButtonRef: React.RefObject<HTMLButtonElement | null>;
    readonly setControlsPopoverPos: (value: {
        top: number;
        right: number;
    }) => void;
    readonly setIsTaskControlsOpen: React.Dispatch<React.SetStateAction<boolean>>;
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
    return (<div className="timeline-context-bar" style={{ position: "relative" }}>
      <div className="timeline-context-bar-main">
        <div className="timeline-context-copy">
          {!embedded && (<div className="timeline-context-title-row">
            <strong className="timeline-context-title">{taskTitle ?? "Waiting for task data…"}</strong>
            {taskUsesDerivedTitle && taskTitle && (<span className="timeline-context-summary-chip accent">Suggested</span>)}
          </div>)}
          <div className="timeline-context-summary-row">
            <span className="timeline-context-summary-chip">{contextSummary.eventSummary}</span>
            {contextSummary.focusSummary && (<span className="timeline-context-summary-chip emphasis">{contextSummary.focusSummary}</span>)}
            {showRuleGapsOnly && (<button className="timeline-context-summary-chip emphasis" onClick={() => onToggleRuleGap(false)} type="button">
                Gaps only ×
              </button>)}
            {selectedRuleId && (<button className="timeline-context-summary-chip emphasis" onClick={onClearRuleId} type="button">
                Rule: {selectedRuleId} ×
              </button>)}
            {selectedTag && (<button className="timeline-context-summary-chip emphasis" onClick={onClearTag} type="button">
                Tag: {selectedTag} ×
              </button>)}
          </div>
        </div>
      </div>

      <div className="timeline-context-bar-actions">
        {(observabilityStats.violations > 0 || observabilityStats.checks > 0) && (<span className="timeline-context-summary-chip timeline-context-obs-stats" style={{ gap: 4, fontSize: "0.66rem" }}>
            {observabilityStats.violations > 0 && <span style={{ color: "var(--err)" }}>{observabilityStats.violations}v</span>}
            {observabilityStats.checks > 0 && <span>{observabilityStats.checks}c</span>}
            {observabilityStats.passes > 0 && <span style={{ color: "var(--ok)" }}>{observabilityStats.passes}p</span>}
          </span>)}

        {!embedded && taskStatus && (<span className={cn("timeline-context-status", TASK_STATUS_BUTTON_STYLES[taskStatus].active)}>
            {taskStatus}
          </span>)}

        {!embedded && (<button ref={controlsButtonRef} aria-expanded={isTaskControlsOpen || isEditingTaskTitle} aria-label="Open task controls" className={cn("timeline-context-toggle", (isTaskControlsOpen || isEditingTaskTitle) && "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]")} onClick={() => {
            if (controlsButtonRef.current) {
                const rect = controlsButtonRef.current.getBoundingClientRect();
                setControlsPopoverPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
            }
            setIsTaskControlsOpen((value) => !value);
        }} title="Task controls" type="button">
          <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
            <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
          </svg>
          <span className="hidden text-[0.72rem] font-medium sm:inline">Controls</span>
        </button>)}

        {!embedded && (<button ref={filtersButtonRef} aria-expanded={isFiltersOpen} aria-label="Open filters and zoom" className={cn("timeline-context-toggle", isFiltersOpen && "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]")} onClick={() => {
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
          {activeLaneCount < totalLaneCount && (<span style={{ fontSize: "0.58rem", fontWeight: 700, lineHeight: 1 }}>
              {activeLaneCount}
            </span>)}
        </button>)}
      </div>
    </div>);
}
