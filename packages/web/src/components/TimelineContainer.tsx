import type React from "react";
import { useMemo } from "react";
import { useMonitorStore } from "@monitor/web-store";
import { cn } from "../lib/ui/cn.js";
import { Timeline } from "./Timeline.js";
import { buildTaskTimelineSummary } from "@monitor/web-core";
interface TimelineContainerProps {
    readonly isCompactDashboard: boolean;
    readonly isStackedDashboard: boolean;
    readonly zoom: number;
    readonly selectedTaskDisplayTitle: string | null;
    readonly selectedTaskUsesDerivedTitle: boolean;
    readonly onZoomChange: (zoom: number) => void;
    readonly onOpenTaskWorkspace?: (() => void) | undefined;
}
export function TimelineContainer({ isCompactDashboard, isStackedDashboard, zoom, selectedTaskDisplayTitle, selectedTaskUsesDerivedTitle, onZoomChange, onOpenTaskWorkspace }: TimelineContainerProps): React.JSX.Element {
    const { state, dispatch, handleTaskStatusChange, handleTaskTitleSubmit } = useMonitorStore();
    const { status, errorMessage, taskDetail, selectedEventId, selectedConnectorKey, selectedRuleId, selectedTag, showRuleGapsOnly, nowMs, isEditingTaskTitle, taskTitleDraft, taskTitleError, isSavingTaskTitle, isUpdatingTaskStatus } = state;
    const taskTimeline = taskDetail?.timeline ?? [];
    const { observabilityStats } = useMemo(() => buildTaskTimelineSummary(taskTimeline), [taskTimeline]);
    return (<section className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]", isCompactDashboard && "min-h-[22rem]", isStackedDashboard && "order-1 min-h-[28rem]")}>
      {status === "error" && (<div className="error-banner flex-shrink-0 border-b border-[#fca5a5] bg-[var(--err-bg)] px-3.5 py-2 text-[0.82rem] text-[var(--err)]">
          <strong>Monitor unavailable</strong>
          <p className="m-0">{errorMessage}</p>
        </div>)}

      <Timeline zoom={zoom} onZoomChange={onZoomChange} timeline={taskTimeline} taskTitle={selectedTaskDisplayTitle} taskWorkspacePath={taskDetail?.task.workspacePath} taskStatus={taskDetail?.task.status} taskUpdatedAt={taskDetail?.task.updatedAt} taskUsesDerivedTitle={selectedTaskUsesDerivedTitle} isEditingTaskTitle={isEditingTaskTitle} taskTitleDraft={taskTitleDraft} taskTitleError={taskTitleError} isSavingTaskTitle={isSavingTaskTitle} isUpdatingTaskStatus={isUpdatingTaskStatus} selectedEventId={selectedEventId} selectedConnectorKey={selectedConnectorKey} selectedRuleId={selectedRuleId} selectedTag={selectedTag} showRuleGapsOnly={showRuleGapsOnly} nowMs={nowMs} observabilityStats={observabilityStats} onSelectEvent={(id) => {
            dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
            dispatch({ type: "SELECT_EVENT", eventId: id });
        }} onSelectConnector={(key) => {
            dispatch({ type: "SELECT_CONNECTOR", connectorKey: key });
            dispatch({ type: "SELECT_EVENT", eventId: null });
        }} onStartEditTitle={() => {
            dispatch({ type: "SET_TASK_TITLE_DRAFT", draft: selectedTaskDisplayTitle ?? taskDetail?.task.title ?? "" });
            dispatch({ type: "SET_TASK_TITLE_ERROR", error: null });
            dispatch({ type: "SET_EDITING_TASK_TITLE", isEditing: true });
        }} onCancelEditTitle={() => {
            dispatch({ type: "SET_TASK_TITLE_DRAFT", draft: selectedTaskDisplayTitle ?? taskDetail?.task.title ?? "" });
            dispatch({ type: "SET_TASK_TITLE_ERROR", error: null });
            dispatch({ type: "SET_EDITING_TASK_TITLE", isEditing: false });
        }} onSubmitTitle={(e) => void handleTaskTitleSubmit(e, taskTitleDraft)} onTitleDraftChange={(val) => dispatch({ type: "SET_TASK_TITLE_DRAFT", draft: val })} onClearFilters={() => {
            dispatch({ type: "SELECT_RULE", ruleId: null });
            dispatch({ type: "SELECT_TAG", tag: null });
            dispatch({ type: "SET_SHOW_RULE_GAPS_ONLY", show: false });
        }} onToggleRuleGap={(show) => dispatch({ type: "SET_SHOW_RULE_GAPS_ONLY", show })} onClearRuleId={() => dispatch({ type: "SELECT_RULE", ruleId: null })} onClearTag={() => dispatch({ type: "SELECT_TAG", tag: null })} {...(onOpenTaskWorkspace !== undefined ? { onOpenTaskWorkspace } : {})} onChangeTaskStatus={(s) => void handleTaskStatusChange(s)}/>
    </section>);
}
