import {
  ArchiveIcon,
  IconButton,
  Tooltip,
  TrashIcon,
  UnarchiveIcon,
} from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import type { TaskRowActionHandler } from "~web/widgets/task-list/row/useTaskRowActions.js";

interface TaskRowActionsProps {
  readonly archived: boolean;
  readonly archivePending: boolean;
  readonly archiveFailed: boolean;
  readonly unarchiveFailed: boolean;
  readonly deletePending: boolean;
  readonly deleteFailed: boolean;
  readonly deleteArmed: boolean;
  readonly onArchive: TaskRowActionHandler;
  readonly onUnarchive: TaskRowActionHandler;
  readonly onDelete: TaskRowActionHandler;
}

/** 태스크 보관과 복원 및 숨기기 컨트롤을 표시한다. */
export function TaskRowActions({
  archived,
  archivePending,
  archiveFailed,
  unarchiveFailed,
  deletePending,
  deleteFailed,
  deleteArmed,
  onArchive,
  onUnarchive,
  onDelete,
}: TaskRowActionsProps) {
  const lifecycleFailed = archiveFailed || unarchiveFailed;

  return (
    <>
      <Tooltip
        content={
          archived
            ? unarchiveFailed
              ? "Unarchive failed — try again"
              : "Unarchive task"
            : archiveFailed
              ? "Archive failed — try again"
              : "Archive task"
        }
        side="left"
      >
        <IconButton
          onClick={archived ? onUnarchive : onArchive}
          aria-label={archived ? "Unarchive task" : "Archive task"}
          tone={lifecycleFailed ? "danger" : "neutral"}
          className={cn(
            "transition-opacity",
            lifecycleFailed || archivePending
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
          )}
        >
          {archived ? <UnarchiveIcon /> : <ArchiveIcon />}
        </IconButton>
      </Tooltip>
      <Tooltip
        content={
          deleteArmed
            ? "Click again to confirm"
            : deleteFailed
              ? "Hide failed — try again"
              : "Hide task"
        }
        side="left"
      >
        <IconButton
          onClick={onDelete}
          aria-label={deleteArmed ? "Confirm hide" : "Hide task"}
          tone={deleteFailed || deleteArmed ? "danger" : "neutral"}
          armed={deleteArmed}
          className={cn(
            "transition-opacity",
            deleteArmed || deleteFailed || deletePending
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
          )}
        >
          <TrashIcon />
        </IconButton>
      </Tooltip>
    </>
  );
}
