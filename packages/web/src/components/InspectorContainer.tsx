import type React from "react";
import { useMemo } from "react";
import { EventId } from "@monitor/core";
import { useMonitorStore } from "@monitor/web-store";
import { cn } from "../lib/ui/cn.js";
import { QuickInspector } from "./QuickInspector.js";
import { updateEventDisplayTitle } from "@monitor/web-core";
import { buildTaskWorkspaceSelection, useTaskObservability } from "@monitor/web-core";
interface InspectorContainerProps {
    readonly isStackedDashboard: boolean;
    readonly isInspectorCollapsed: boolean;
    readonly selectedTaskDisplayTitle: string | null;
    readonly onToggleCollapse: () => void;
    readonly onInspectorResizeStart?: ((event: React.PointerEvent<HTMLDivElement>) => void) | undefined;
    readonly onOpenTaskWorkspace?: (() => void) | undefined;
}
export function InspectorContainer({ isStackedDashboard, isInspectorCollapsed, selectedTaskDisplayTitle, onToggleCollapse, onOpenTaskWorkspace }: InspectorContainerProps): React.JSX.Element {
    const { state, dispatch, refreshTaskDetail, handleCreateTaskBookmark, handleCreateEventBookmark } = useMonitorStore();
    const { bookmarks, selectedTaskId, selectedEventId, selectedConnectorKey, selectedTag, selectedRuleId, showRuleGapsOnly, taskDetail } = state;
    const { taskObservability } = useTaskObservability(selectedTaskId);
    const taskTimeline = taskDetail?.timeline ?? [];
    const workspaceSelection = useMemo(() => buildTaskWorkspaceSelection({
        timeline: taskTimeline,
        selectedConnectorKey,
        selectedEventId,
        selectedRuleId,
        selectedTag,
        showRuleGapsOnly,
        taskDisplayTitle: selectedTaskDisplayTitle
    }), [selectedConnectorKey, selectedEventId, selectedRuleId, selectedTag, selectedTaskDisplayTitle, showRuleGapsOnly, taskTimeline]);
    const { selectedConnector, selectedEvent, selectedEventDisplayTitle, modelSummary } = workspaceSelection;
    const selectedTaskBookmark = selectedTaskId
        ? bookmarks.find((b) => b.taskId === selectedTaskId && !b.eventId) ?? null
        : null;
    const selectedEventBookmark = selectedEvent
        ? bookmarks.find((b) => b.eventId === selectedEvent.id) ?? null
        : null;
    return (<div className={cn("relative flex min-h-0 min-w-0 flex-col", isStackedDashboard && "order-3")}>
      <QuickInspector className={cn(isStackedDashboard && "min-h-[20rem]")} showCollapseControl={!isStackedDashboard} taskDetail={taskDetail} selectedTaskTitle={selectedTaskDisplayTitle} taskObservability={taskObservability} taskModelSummary={modelSummary} selectedEvent={selectedEvent} selectedConnector={selectedConnector} selectedEventDisplayTitle={selectedEventDisplayTitle} selectedTaskBookmark={selectedTaskBookmark} selectedEventBookmark={selectedEventBookmark} selectedTag={selectedTag} selectedRuleId={selectedRuleId} isCollapsed={isInspectorCollapsed} {...(onOpenTaskWorkspace !== undefined ? { onOpenTaskWorkspace } : {})} onToggleCollapse={onToggleCollapse} onCreateTaskBookmark={() => {
            void handleCreateTaskBookmark().catch((err) => {
                dispatch({
                    type: "SET_STATUS",
                    status: "error",
                    errorMessage: err instanceof Error ? err.message : "Failed to save task bookmark."
                });
            });
        }} onCreateEventBookmark={() => {
            if (!selectedEvent)
                return;
            void handleCreateEventBookmark(selectedEvent.id, selectedEventDisplayTitle ?? selectedEvent.title).catch((err) => {
                dispatch({
                    type: "SET_STATUS",
                    status: "error",
                    errorMessage: err instanceof Error ? err.message : "Failed to save event bookmark."
                });
            });
        }} onUpdateEventDisplayTitle={async (eventId, displayTitle) => {
            if (!selectedTaskId)
                return;
            await updateEventDisplayTitle(EventId(eventId), displayTitle);
            await refreshTaskDetail(selectedTaskId);
        }} onSelectTag={(tag) => dispatch({ type: "SELECT_TAG", tag })} onSelectRule={(ruleId) => {
            dispatch({ type: "SET_SHOW_RULE_GAPS_ONLY", show: false });
            dispatch({ type: "SELECT_RULE", ruleId });
        }}/>
    </div>);
}
