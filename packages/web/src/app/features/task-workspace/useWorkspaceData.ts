import { useMemo } from "react";
import type { TaskId } from "../../../types.js";
import {
    buildTaskDisplayTitle,
    buildTaskTimelineSummary,
    buildTaskWorkspaceSelection,
} from "../../../types.js";
import {
    useNowMs,
    useSelectionStore,
    useTaskDetailQuery,
    useTaskObservability,
} from "../../../state.js";

export function useWorkspaceData(taskId: string) {
    const selectedTaskId = useSelectionStore((s) => s.selectedTaskId);
    const selectedEventId = useSelectionStore((s) => s.selectedEventId);
    const selectedConnectorKey = useSelectionStore((s) => s.selectedConnectorKey);
    const selectedRuleId = useSelectionStore((s) => s.selectedRuleId);
    const selectedTag = useSelectionStore((s) => s.selectedTag);
    const showRuleGapsOnly = useSelectionStore((s) => s.showRuleGapsOnly);

    const { data: taskDetail } = useTaskDetailQuery(taskId as TaskId);
    const { taskObservability, refreshTaskObservability } = useTaskObservability(taskId);
    const nowMs = useNowMs();

    const selectedTaskDetail = taskDetail?.task.id === taskId ? taskDetail : null;
    const taskTimeline = selectedTaskDetail?.timeline ?? [];

    const selectedTaskDisplayTitle = useMemo(
        () => (selectedTaskDetail?.task ? buildTaskDisplayTitle(selectedTaskDetail.task, taskTimeline) : null),
        [selectedTaskDetail, taskTimeline]
    );
    const selectedTaskUsesDerivedTitle = Boolean(
        selectedTaskDetail?.task &&
        selectedTaskDisplayTitle &&
        selectedTaskDisplayTitle.trim() !== selectedTaskDetail.task.title.trim()
    );
    const { recentRuleDecisions, observabilityStats, modelSummary } = useMemo(
        () => buildTaskTimelineSummary(taskTimeline),
        [taskTimeline]
    );
    const workspaceSelection = useMemo(
        () => buildTaskWorkspaceSelection({
            timeline: taskTimeline,
            selectedConnectorKey,
            selectedEventId,
            selectedRuleId,
            selectedTag,
            showRuleGapsOnly,
            taskDisplayTitle: selectedTaskDisplayTitle,
        }),
        [selectedConnectorKey, selectedEventId, selectedRuleId, selectedTag, selectedTaskDisplayTitle, showRuleGapsOnly, taskTimeline]
    );
    const { selectedConnector, selectedEvent, selectedEventDisplayTitle } = workspaceSelection;

    const workspaceMissingTask = taskDetail == null && selectedTaskId === taskId && !selectedTaskDetail;
    const workspaceLoading = !workspaceMissingTask && !selectedTaskDetail;

    return {
        selectedEventId,
        selectedConnectorKey,
        selectedRuleId,
        selectedTag,
        showRuleGapsOnly,
        selectedTaskDetail,
        taskTimeline,
        taskObservability,
        refreshTaskObservability,
        nowMs,
        selectedTaskDisplayTitle,
        selectedTaskUsesDerivedTitle,
        recentRuleDecisions,
        observabilityStats,
        modelSummary,
        selectedConnector,
        selectedEvent,
        selectedEventDisplayTitle,
        workspaceMissingTask,
        workspaceLoading,
    };
}

export type WorkspaceData = ReturnType<typeof useWorkspaceData>;
