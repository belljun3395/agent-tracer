import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import { useConfirmAction } from "~web/shared/lib/hooks/use-confirm-action.js";
import {
  useArchiveTaskMutation,
  useDeleteTaskMutation,
  useUnarchiveTaskMutation,
} from "~web/entities/task/api/lifecycle-mutations.js";
import {
  useSelectedTaskId,
  useToggleCollapsedParent,
} from "~web/shared/store/index.js";

export type TaskRowActionHandler = (
  event: MouseEvent<HTMLButtonElement>,
) => void;

/** 행 액션의 라우팅과 변경 요청 및 2단계 확인 상태를 소유한다. */
export function useTaskRowActions(task: MonitoringTask) {
  const selectedTaskId = useSelectedTaskId();
  const navigate = useNavigate();
  const deleteMutation = useDeleteTaskMutation();
  const archiveMutation = useArchiveTaskMutation();
  const unarchiveMutation = useUnarchiveTaskMutation();
  const toggleCollapsed = useToggleCollapsedParent();
  const active = selectedTaskId === task.id;

  const confirmDelete = useConfirmAction(() => {
    deleteMutation.mutate(task.id, {
      onSuccess: () => {
        if (active) void navigate("/tasks");
      },
    });
  });

  const stopRowNavigation = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDelete: TaskRowActionHandler = (event) => {
    stopRowNavigation(event);
    confirmDelete.trigger();
  };

  const handleArchive: TaskRowActionHandler = (event) => {
    stopRowNavigation(event);
    archiveMutation.mutate(task.id, {
      onSuccess: () => {
        if (active) void navigate("/tasks");
      },
    });
  };

  const handleUnarchive: TaskRowActionHandler = (event) => {
    stopRowNavigation(event);
    unarchiveMutation.mutate(task.id);
  };

  const handleToggle: TaskRowActionHandler = (event) => {
    stopRowNavigation(event);
    toggleCollapsed(task.id);
  };

  return {
    active,
    pending:
      deleteMutation.isPending ||
      archiveMutation.isPending ||
      unarchiveMutation.isPending,
    deletePending: deleteMutation.isPending,
    archivePending:
      archiveMutation.isPending || unarchiveMutation.isPending,
    deleteFailed:
      deleteMutation.isError && deleteMutation.variables === task.id,
    archiveFailed:
      archiveMutation.isError && archiveMutation.variables === task.id,
    unarchiveFailed:
      unarchiveMutation.isError && unarchiveMutation.variables === task.id,
    deleteArmed: confirmDelete.armed,
    disarmDelete: confirmDelete.disarm,
    handleDelete,
    handleArchive,
    handleUnarchive,
    handleToggle,
  } as const;
}
