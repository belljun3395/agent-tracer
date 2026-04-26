import { useCallback } from "react";
import type { SyntheticEvent } from "react";
import type { TaskId } from "../../../types.js";
import { EventId } from "../../../types.js";
import type { MonitoringTask } from "../../../types.js";
import {
    updateEventDisplayTitle,
    updateTaskStatus,
    updateTaskTitle,
} from "../../../io.js";
import { monitorQueryKeys, useEditStore } from "../../../state.js";
import { useQueryClient } from "@tanstack/react-query";
import type { WorkspaceData } from "./useWorkspaceData.js";

export function useWorkspaceMutations(taskId: string, data: WorkspaceData) {
    const { selectedTaskDetail } = data;

    const setTitleError = useEditStore((s) => s.setTitleError);
    const finishEditing = useEditStore((s) => s.finishEditing);
    const setSavingTitle = useEditStore((s) => s.setSavingTitle);
    const setUpdatingStatus = useEditStore((s) => s.setUpdatingStatus);

    const queryClient = useQueryClient();

    const handleTaskStatusChange = useCallback(
        async (status: MonitoringTask["status"]): Promise<void> => {
            if (!selectedTaskDetail?.task) return;
            setUpdatingStatus(true);
            try {
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
        async (event: SyntheticEvent<HTMLFormElement>, nextTitle: string): Promise<void> => {
            event.preventDefault();
            if (!selectedTaskDetail?.task) return;
            const trimmed = nextTitle.trim();
            if (!trimmed) { setTitleError("Title cannot be empty."); return; }
            if (trimmed === selectedTaskDetail.task.title.trim()) { setTitleError(null); finishEditing(); return; }
            setSavingTitle(true);
            setTitleError(null);
            try {
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

    const handleUpdateEventDisplayTitle = useCallback(
        async (eventId: string, displayTitle: string | null): Promise<void> => {
            await updateEventDisplayTitle(EventId(eventId), displayTitle ?? "");
            await queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskDetail(taskId as TaskId) });
        },
        [taskId, queryClient]
    );

    return {
        handleTaskStatusChange,
        handleTaskTitleSubmit,
        handleUpdateEventDisplayTitle,
    };
}

export type WorkspaceMutations = ReturnType<typeof useWorkspaceMutations>;
