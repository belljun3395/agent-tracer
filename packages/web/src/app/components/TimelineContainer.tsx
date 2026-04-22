import type React from "react";
import { useCallback, useMemo } from "react";
import type { TaskId } from "../../types.js";
import { buildTaskTimelineSummary } from "../../types.js";
import type { MonitoringTask } from "../../types.js";
import { updateTaskStatus, updateTaskTitle } from "../../io.js";
import {
    monitorQueryKeys,
    useEditStore,
    useNowMs,
    useSelectionStore,
    useTaskDetailQuery
} from "../../state.js";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "../lib/ui/cn.js";
import { Timeline } from "./Timeline.js";
import type { TimelineProps } from "../features/timeline/types.js";

interface TimelineContainerProps {
    readonly isCompactDashboard: boolean;
    readonly isStackedDashboard: boolean;
    readonly zoom: number;
    readonly selectedTaskDisplayTitle: string | null;
    readonly selectedTaskUsesDerivedTitle: boolean;
    readonly onZoomChange: (zoom: number) => void;
    readonly externalFiltersState?: TimelineProps["externalFiltersState"];
    readonly externalTimelineFilters?: TimelineProps["externalTimelineFilters"];
}

export function TimelineContainer({
    isCompactDashboard,
    isStackedDashboard,
    zoom,
    selectedTaskDisplayTitle,
    selectedTaskUsesDerivedTitle,
    onZoomChange,
    externalFiltersState,
    externalTimelineFilters
}: TimelineContainerProps): React.JSX.Element {
    const selectedTaskId = useSelectionStore((s) => s.selectedTaskId);
    const selectedEventId = useSelectionStore((s) => s.selectedEventId);
    const selectedConnectorKey = useSelectionStore((s) => s.selectedConnectorKey);
    const selectedRuleId = useSelectionStore((s) => s.selectedRuleId);
    const showRuleGapsOnly = useSelectionStore((s) => s.showRuleGapsOnly);
    const selectEvent = useSelectionStore((s) => s.selectEvent);
    const selectConnector = useSelectionStore((s) => s.selectConnector);
    const selectRule = useSelectionStore((s) => s.selectRule);
    const selectTag = useSelectionStore((s) => s.selectTag);
    const setShowRuleGapsOnly = useSelectionStore((s) => s.setShowRuleGapsOnly);
    const resetFilters = useSelectionStore((s) => s.resetFilters);

    const isEditingTaskTitle = useEditStore((s) => s.isEditingTaskTitle);
    const taskTitleDraft = useEditStore((s) => s.taskTitleDraft);
    const taskTitleError = useEditStore((s) => s.taskTitleError);
    const isSavingTaskTitle = useEditStore((s) => s.isSavingTaskTitle);
    const isUpdatingTaskStatus = useEditStore((s) => s.isUpdatingTaskStatus);
    const startEditing = useEditStore((s) => s.startEditing);
    const updateDraft = useEditStore((s) => s.updateDraft);
    const setTitleError = useEditStore((s) => s.setTitleError);
    const finishEditing = useEditStore((s) => s.finishEditing);
    const setSavingTitle = useEditStore((s) => s.setSavingTitle);
    const setUpdatingStatus = useEditStore((s) => s.setUpdatingStatus);

    const { data: taskDetail, isError, error } = useTaskDetailQuery(
        selectedTaskId != null ? (selectedTaskId as TaskId) : null
    );
    const nowMs = useNowMs();
    const queryClient = useQueryClient();

    const taskTimeline = taskDetail?.timeline ?? [];
    const { observabilityStats } = useMemo(() => buildTaskTimelineSummary(taskTimeline), [taskTimeline]);

    const handleTaskStatusChange = useCallback(
        async (status: MonitoringTask["status"]): Promise<void> => {
            if (!taskDetail?.task) return;
            setUpdatingStatus(true);
            try {
                await updateTaskStatus(taskDetail.task.id, status);
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: monitorQueryKeys.tasks() }),
                    queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskDetail(taskDetail.task.id) }),
                ]);
            } finally {
                setUpdatingStatus(false);
            }
        },
        [taskDetail?.task, setUpdatingStatus, queryClient]
    );

    const handleTaskTitleSubmit = useCallback(
        async (event: React.SyntheticEvent<HTMLFormElement>, nextTitle: string): Promise<void> => {
            event.preventDefault();
            if (!taskDetail?.task) return;
            const trimmed = nextTitle.trim();
            if (!trimmed) {
                setTitleError("Title cannot be empty.");
                return;
            }
            if (trimmed === taskDetail.task.title.trim()) {
                setTitleError(null);
                finishEditing();
                return;
            }
            setSavingTitle(true);
            setTitleError(null);
            try {
                await updateTaskTitle(taskDetail.task.id, trimmed);
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: monitorQueryKeys.tasks() }),
                    queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskDetail(taskDetail.task.id) }),
                ]);
                finishEditing();
            } catch (err) {
                setTitleError(err instanceof Error ? err.message : "Failed to save task title.");
            } finally {
                setSavingTitle(false);
            }
        },
        [taskDetail?.task, setTitleError, finishEditing, setSavingTitle, queryClient]
    );

    return (
        <section
            className={cn(
                "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-none",
                isCompactDashboard && "min-h-[22rem]",
                isStackedDashboard && "order-1 min-h-[28rem]"
            )}
        >
            {isError && (
                <div className="error-banner flex-shrink-0 border-b border-[#fca5a5] bg-[var(--err-bg)] px-3.5 py-2 text-[0.82rem] text-[var(--err)]">
                    <strong>Monitor unavailable</strong>
                    <p className="m-0">{error instanceof Error ? error.message : "Failed to load monitor data."}</p>
                </div>
            )}
            <Timeline
                zoom={zoom}
                onZoomChange={onZoomChange}
                timeline={taskTimeline}
                taskTitle={selectedTaskDisplayTitle}
                taskWorkspacePath={taskDetail?.task.workspacePath}
                taskStatus={taskDetail?.task.status}
                taskUpdatedAt={taskDetail?.task.updatedAt}
                taskUsesDerivedTitle={selectedTaskUsesDerivedTitle}
                isEditingTaskTitle={isEditingTaskTitle}
                taskTitleDraft={taskTitleDraft}
                taskTitleError={taskTitleError}
                isSavingTaskTitle={isSavingTaskTitle}
                isUpdatingTaskStatus={isUpdatingTaskStatus}
                selectedEventId={selectedEventId}
                selectedConnectorKey={selectedConnectorKey}
                selectedRuleId={selectedRuleId}
                showRuleGapsOnly={showRuleGapsOnly}
                nowMs={nowMs}
                observabilityStats={observabilityStats}
                onSelectEvent={(id) => {
                    selectConnector(null);
                    selectEvent(id);
                }}
                onSelectConnector={(key) => {
                    selectConnector(key);
                    selectEvent(null);
                }}
                onStartEditTitle={() => {
                    startEditing(selectedTaskDisplayTitle ?? taskDetail?.task.title ?? "");
                }}
                onCancelEditTitle={() => {
                    updateDraft(selectedTaskDisplayTitle ?? taskDetail?.task.title ?? "");
                    setTitleError(null);
                    finishEditing();
                }}
                onSubmitTitle={(e) => void handleTaskTitleSubmit(e, taskTitleDraft)}
                onTitleDraftChange={updateDraft}
                onClearFilters={() => {
                    selectRule(null);
                    selectTag(null);
                    resetFilters();
                }}
                onToggleRuleGap={setShowRuleGapsOnly}
                onClearRuleId={() => selectRule(null)}
                onChangeTaskStatus={(s) => void handleTaskStatusChange(s)}
                {...(externalFiltersState !== undefined ? { externalFiltersState } : {})}
                {...(externalTimelineFilters !== undefined ? { externalTimelineFilters } : {})}
            />
        </section>
    );
}
