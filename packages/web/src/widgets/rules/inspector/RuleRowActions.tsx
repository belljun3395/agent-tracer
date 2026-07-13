import type { MouseEvent } from "react";
import type { RuleRecord } from "~web/entities/rule/model/rule.js";
import type { TaskId } from "~web/shared/identity.js";
import { DownIcon, IconButton, PencilIcon, RefreshIcon, Tooltip, TrashIcon, UpIcon } from "~web/shared/ui/index.js";

interface RuleRowActionsProps {
  readonly rule: RuleRecord;
  readonly contextTaskId: TaskId | null;
  readonly isPending: boolean;
  readonly deleteFailed: boolean;
  readonly deleteArmed: boolean;
  readonly onReEval: (e: MouseEvent<HTMLButtonElement>) => void;
  readonly onPromote: (e: MouseEvent<HTMLButtonElement>) => void;
  readonly onDemote: (e: MouseEvent<HTMLButtonElement>) => void;
  readonly onEdit: (e: MouseEvent<HTMLButtonElement>) => void;
  readonly onDelete: (e: MouseEvent<HTMLButtonElement>) => void;
}

/** 모든 규칙 행이 공유하는 재평가/승격/강등/편집/삭제 아이콘 버튼 행. */
export function RuleRowActions({
  rule,
  contextTaskId,
  isPending,
  deleteFailed,
  deleteArmed,
  onReEval,
  onPromote,
  onDemote,
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
      {rule.scope === "task" && (
        <Tooltip content="Promote to global rule" side="top">
          <IconButton onClick={onPromote} disabled={isPending} aria-label="Promote" className="h-6 w-6">
            <UpIcon />
          </IconButton>
        </Tooltip>
      )}
      {rule.scope === "global" && contextTaskId !== null && (
        <Tooltip content="Demote to this task" side="top">
          <IconButton onClick={onDemote} disabled={isPending} aria-label="Demote" className="h-6 w-6">
            <DownIcon />
          </IconButton>
        </Tooltip>
      )}
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
