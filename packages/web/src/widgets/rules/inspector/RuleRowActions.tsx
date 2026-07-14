import type { MouseEvent } from "react";
import type { TaskId } from "~web/shared/identity.js";
import { IconButton, PencilIcon, RefreshIcon, Tooltip, TrashIcon } from "~web/shared/ui/index.js";

interface RuleRowActionsProps {
  readonly contextTaskId: TaskId | null;
  readonly isPending: boolean;
  readonly deleteFailed: boolean;
  readonly deleteArmed: boolean;
  readonly onReEval: (e: MouseEvent<HTMLButtonElement>) => void;
  readonly onEdit: (e: MouseEvent<HTMLButtonElement>) => void;
  readonly onDelete: (e: MouseEvent<HTMLButtonElement>) => void;
}

/** 모든 규칙 행이 공유하는 재평가/편집/삭제 아이콘 버튼 행. */
export function RuleRowActions({
  contextTaskId,
  isPending,
  deleteFailed,
  deleteArmed,
  onReEval,
  onEdit,
  onDelete,
}: RuleRowActionsProps) {
  return (
    <div className="flex items-center gap-1 mt-2">
      <Tooltip content={contextTaskId ? "Re-evaluate against current task" : "Re-evaluate"} side="top">
        <IconButton onClick={onReEval} disabled={isPending} aria-label="Re-evaluate" className="h-6 w-6">
          <RefreshIcon />
        </IconButton>
      </Tooltip>
      <Tooltip content="Edit rule" side="top">
        <IconButton onClick={onEdit} disabled={isPending} aria-label="Edit" className="h-6 w-6">
          <PencilIcon />
        </IconButton>
      </Tooltip>
      <span className="flex-1" />
      <Tooltip
        content={deleteArmed ? "Click again to confirm" : deleteFailed ? "Delete failed — try again" : "Delete rule"}
        side="top"
      >
        <IconButton
          onClick={onDelete}
          disabled={isPending}
          aria-label={deleteArmed ? "Confirm delete" : "Delete"}
          tone={deleteArmed || deleteFailed ? "danger" : "neutral"}
          armed={deleteArmed}
          className="h-6 w-6"
        >
          <TrashIcon />
        </IconButton>
      </Tooltip>
    </div>
  );
}
