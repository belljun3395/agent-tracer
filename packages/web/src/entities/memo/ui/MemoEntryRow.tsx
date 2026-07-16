import { useState } from "react";
import type { GuidanceLocale, GuidanceMessage } from "~web/shared/guidance.js";
import type { MemoRecord } from "~web/entities/memo/model/memo.js";
import { useConfirmAction } from "~web/shared/lib/hooks/use-confirm-action.js";
import { Button, GuidanceText, Input } from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";

interface MemoEntryRowProps {
  readonly memo: MemoRecord;
  readonly editHint: GuidanceMessage;
  readonly deleteHint: GuidanceMessage;
  readonly locale: GuidanceLocale;
  readonly isUpdating: boolean;
  readonly isDeleting: boolean;
  readonly onUpdate: (body: string) => void;
  readonly onDelete: () => void;
}

/** 태스크 메모 스레드와 이벤트 메모 스레드가 함께 쓰는 메모 한 건의 행이다. */
export function MemoEntryRow({
  memo,
  editHint,
  deleteHint,
  locale,
  isUpdating,
  isDeleting,
  onUpdate,
  onDelete,
}: MemoEntryRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memo.body);
  const confirmDelete = useConfirmAction(onDelete);
  const isPending = isUpdating || isDeleting;

  const startEdit = () => {
    setDraft(memo.body);
    setEditing(true);
  };

  const saveEdit = () => {
    const body = draft.trim();
    if (body && body !== memo.body) onUpdate(body);
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "rounded-xs border border-hair bg-s2 px-2.5 py-2",
        isPending && "opacity-50",
      )}
    >
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <GuidanceText
            as="p"
            className="m-0 text-[10.5px] text-ink-tertiary"
            locale={locale}
            message={editHint}
          />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="text-[12px] py-1"
            autoFocus
          />
          <div className="flex items-center gap-1.5">
            <Button onClick={saveEdit} disabled={isPending}>
              Save
            </Button>
            <Button onClick={() => setEditing(false)} disabled={isPending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="m-0 text-[12.5px] leading-[1.5] text-ink whitespace-pre-wrap">
            {memo.body}
          </p>
          <div className="flex items-center gap-2 mt-1.5 font-mono text-[10px] text-ink-tertiary">
            <span>{memo.author}</span>
            <span className="text-hair-strong">·</span>
            <span>{memo.lastEditedBy}</span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={startEdit}
              disabled={isPending}
              className="text-ink-muted hover:text-ink"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={confirmDelete.trigger}
              disabled={isPending}
              className={cn(confirmDelete.armed ? "text-err" : "text-ink-muted hover:text-ink")}
            >
              {confirmDelete.armed ? "Confirm delete" : "Delete"}
            </button>
          </div>
          {confirmDelete.armed && (
            <GuidanceText
              as="p"
              className="m-0 mt-1 text-right text-[10px] text-err"
              locale={locale}
              message={deleteHint}
            />
          )}
        </>
      )}
    </div>
  );
}
