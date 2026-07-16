import { useState } from "react";
import { MEMO_AUTHOR } from "@monitor/kernel";
import type { EventId, TaskId } from "~web/shared/identity.js";
import type { GuidanceLocale, GuidanceMessage } from "~web/shared/guidance.js";
import {
  useCreateMemoMutation,
  useDeleteMemoMutation,
  useUpdateMemoMutation,
} from "~web/entities/memo/api/mutations.js";
import type { MemoRecord } from "~web/entities/memo/model/memo.js";
import { Button, GuidanceText, Input } from "~web/shared/ui/index.js";
import { MemoEntryRow } from "~web/entities/memo/ui/MemoEntryRow.js";

interface MemoThreadListProps {
  readonly memos: readonly MemoRecord[];
  readonly taskId: TaskId;
  /** 지정하면 새 메모가 이 이벤트에 매달리고, 지정하지 않으면 태스크 수준 메모가 된다. */
  readonly eventId?: EventId;
  readonly emptyMessage: GuidanceMessage;
  readonly editHint: GuidanceMessage;
  readonly deleteHint: GuidanceMessage;
  readonly locale: GuidanceLocale;
  readonly addPlaceholder: string;
}

/** 태스크 헤더의 메모 스레드와 Inspect 탭의 이벤트 메모 스레드가 함께 쓰는 목록/추가 편집기다. */
export function MemoThreadList({
  memos,
  taskId,
  eventId,
  emptyMessage,
  editHint,
  deleteHint,
  locale,
  addPlaceholder,
}: MemoThreadListProps) {
  const [draft, setDraft] = useState("");
  const createMutation = useCreateMemoMutation();
  const updateMutation = useUpdateMemoMutation();
  const deleteMutation = useDeleteMemoMutation();

  const onSubmit = (event: { readonly preventDefault: () => void }) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    createMutation.mutate(
      { taskId, body, author: MEMO_AUTHOR.human, ...(eventId ? { eventId } : {}) },
      { onSuccess: () => setDraft("") },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {memos.length === 0 ? (
        <GuidanceText
          as="p"
          className="m-0 text-[11.5px] text-ink-subtle"
          locale={locale}
          message={emptyMessage}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {memos.map((memo) => (
            <MemoEntryRow
              key={memo.id}
              memo={memo}
              editHint={editHint}
              deleteHint={deleteHint}
              locale={locale}
              isUpdating={
                updateMutation.isPending && updateMutation.variables.memoId === memo.id
              }
              isDeleting={deleteMutation.isPending && deleteMutation.variables === memo.id}
              onUpdate={(body) => updateMutation.mutate({ memoId: memo.id, body: { body } })}
              onDelete={() => deleteMutation.mutate(memo.id)}
            />
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={addPlaceholder}
          disabled={createMutation.isPending}
          className="flex-1 text-[12px] py-1.5"
        />
        <Button
          type="submit"
          disabled={createMutation.isPending || draft.trim().length === 0}
        >
          Add
        </Button>
      </form>
    </div>
  );
}
