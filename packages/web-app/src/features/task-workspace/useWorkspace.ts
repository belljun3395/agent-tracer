import { useCallback, useMemo } from "react";
import type { TaskId } from "@monitor/core";
import { EventId } from "@monitor/core";
import type { MonitoringTask } from "@monitor/web-domain";
import { buildTaskDisplayTitle, buildTaskTimelineSummary, buildTaskWorkspaceSelection } from "@monitor/web-domain";
import { createBookmark, postRuleAction, updateEventDisplayTitle } from "@monitor/web-io";
import {
    monitorQueryKeys,
    useBookmarksQuery,
    useEditStore,
    useNowMs,
    useSelectionStore,
    useTaskDetailQuery,
    useTaskObservability,
} from "@monitor/web-state";
import { useQueryClient } from "@tanstack/react-query";

export function useWorkspace(taskId: string) {
    // Selection store
    const selectedTaskId = useSelectionStore((s) => s.selectedTaskId);
    const selectedEventId = useSelectionStore((s) => s.selectedEventId);
    const selectedConnectorKey = useSelectionStore((s) => s.selectedConnectorKey);
    const selectedRuleId = useSelectionStore((s) => s.selectedRuleId);
    const selectedTag = useSelectionStore((s) => s.selectedTag);
    const showRuleGapsOnly = useSelectionStore((s) => s.showRuleGapsOnly);
    const selectEvent = useSelectionStore((s) => s.selectEvent);
    const selectConnector = useSelectionStore((s) => s.selectConnector);
    const selectRule = useSelectionStore((s) => s.selectRule);
    const selectTag = useSelectionStore((s) => s.selectTag);
    const setShowRuleGapsOnly = useSelectionStore((s) => s.setShowRuleGapsOnly);
    const resetFilters = useSelectionStore((s) => s.resetFilters);

    // Edit store
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

    const { data: taskDetail } = useTaskDetailQuery(taskId as TaskId);
    const { data: bookmarksData } = useBookmarksQuery();
    const bookmarks = bookmarksData?.bookmarks ?? [];
    const { taskObservability, refreshTaskObservability } = useTaskObservability(taskId);
    const queryClient = useQueryClient();
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

    const selectedTaskBookmark = useMemo(
        () => bookmarks.find((b) => b.taskId === taskId && !b.eventId) ?? null,
        [bookmarks, taskId]
    );
    const selectedEventBookmark = selectedEvent
        ? (bookmarks.find((b) => b.eventId === selectedEvent.id) ?? null)
        : null;

    const workspaceMissingTask = taskDetail == null && selectedTaskId === taskId && !selectedTaskDetail;
    const workspaceLoading = !workspaceMissingTask && (!selectedTaskDetail || selectedTaskId !== taskId);

    const handleRuleReview = useCallback(
        async (outcome: "approved" | "rejected" | "bypassed", reviewerId: string, reviewerNote: string): Promise<void> => {
            if (!selectedTaskDetail?.task || !taskObservability?.observability.ruleEnforcement.activeRuleId) return;
            await postRuleAction({
                taskId: selectedTaskDetail.task.id,
                action: "review_rule_gate",
                title: outcome === "approved" ? "Approval granted"
                    : outcome === "rejected" ? "Approval rejected"
                    : "Rule bypassed",
                ruleId: taskObservability.observability.ruleEnforcement.activeRuleId,
                severity: outcome === "approved" ? "info" : "warn",
                status: outcome === "approved" || outcome === "bypassed" ? "pass" : "violation",
                source: "workspace-review",
                metadata: { reviewerId, reviewerSource: "workspace-review" },
                ...(reviewerNote.trim() ? { body: reviewerNote.trim() } : {}),
                outcome,
            });
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: monitorQueryKeys.overview() }),
                queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskDetail(taskId as TaskId) }),
                refreshTaskObservability(),
            ]);
        },
        [queryClient, refreshTaskObservability, selectedTaskDetail?.task, taskId, taskObservability?.observability.ruleEnforcement.activeRuleId]
    );

    const handleTaskStatusChange = useCallback(
        async (status: MonitoringTask["status"]): Promise<void> => {
            if (!selectedTaskDetail?.task) return;
            setUpdatingStatus(true);
            try {
                const { updateTaskStatus } = await import("@monitor/web-io");
                await updateTaskStatus(selectedTaskDetail.task.id, status);
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: monitorQueryKeys.tasks() }),
                    queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskDetail(taskId as TaskId) }),
                ]);
            } finally {
                setUpdatingStatus(false);
            }
        },
        [selectedTaskDetail?.task, setUpdatingStatus, queryClient, taskId]
    );

    const handleTaskTitleSubmit = useCallback(
        async (event: React.SyntheticEvent<HTMLFormElement>, nextTitle: string): Promise<void> => {
            event.preventDefault();
            if (!selectedTaskDetail?.task) return;
            const trimmed = nextTitle.trim();
            if (!trimmed) { setTitleError("Title cannot be empty."); return; }
            if (trimmed === selectedTaskDetail.task.title.trim()) { setTitleError(null); finishEditing(); return; }
            setSavingTitle(true);
            setTitleError(null);
            try {
                const { updateTaskTitle } = await import("@monitor/web-io");
                await updateTaskTitle(selectedTaskDetail.task.id, trimmed);
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: monitorQueryKeys.tasks() }),
                    queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskDetail(taskId as TaskId) }),
                ]);
                finishEditing();
            } catch (err) {
                setTitleError(err instanceof Error ? err.message : "Failed to save task title.");
            } finally {
                setSavingTitle(false);
            }
        },
        [selectedTaskDetail?.task, setTitleError, finishEditing, setSavingTitle, queryClient, taskId]
    );

    const handleCreateTaskBookmark = useCallback(async (): Promise<void> => {
        await createBookmark({ taskId: taskId as TaskId });
        await queryClient.invalidateQueries({ queryKey: monitorQueryKeys.bookmarks() });
    }, [taskId, queryClient]);

    const handleCreateEventBookmark = useCallback(async (): Promise<void> => {
        if (!selectedEvent) return;
        await createBookmark({
            taskId: taskId as TaskId,
            eventId: EventId(selectedEvent.id),
            title: selectedEventDisplayTitle ?? selectedEvent.title,
        });
        await queryClient.invalidateQueries({ queryKey: monitorQueryKeys.bookmarks() });
    }, [taskId, selectedEvent, selectedEventDisplayTitle, queryClient]);

    const handleUpdateEventDisplayTitle = useCallback(
        async (eventId: string, displayTitle: string | null): Promise<void> => {
            await updateEventDisplayTitle(EventId(eventId), displayTitle ?? "");
            await queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskDetail(taskId as TaskId) });
        },
        [taskId, queryClient]
    );

    return {
        // Selection state
        selectedEventId, selectedConnectorKey, selectedRuleId, selectedTag, showRuleGapsOnly,
        selectEvent, selectConnector, selectRule, selectTag, setShowRuleGapsOnly, resetFilters,
        // Edit state
        isEditingTaskTitle, taskTitleDraft, taskTitleError, isSavingTaskTitle, isUpdatingTaskStatus,
        startEditing, updateDraft, setTitleError, finishEditing,
        // Data
        selectedTaskDetail, taskTimeline, taskObservability, nowMs,
        selectedTaskDisplayTitle, selectedTaskUsesDerivedTitle,
        recentRuleDecisions, observabilityStats, modelSummary,
        selectedConnector, selectedEvent, selectedEventDisplayTitle,
        selectedTaskBookmark, selectedEventBookmark,
        workspaceMissingTask, workspaceLoading,
        // Handlers
        handleRuleReview, handleTaskStatusChange, handleTaskTitleSubmit,
        handleCreateTaskBookmark, handleCreateEventBookmark,
        handleUpdateEventDisplayTitle,
    };
}

export type WorkspaceState = ReturnType<typeof useWorkspace>;
