import { Link } from "react-router-dom";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { MemoRecord } from "~web/entities/memo/model/memo.js";
import {
  useDeleteMemoMutation,
  useUpdateMemoMutation,
} from "~web/entities/memo/api/mutations.js";
import { MemoEntryRow } from "~web/entities/memo/ui/MemoEntryRow.js";
import { useGuidance, useSetSelectedEventId } from "~web/shared/store/index.js";
import { EventId } from "~web/shared/identity.js";
import { MemoTaskBreadcrumb } from "~web/widgets/memos/MemoTaskBreadcrumb.js";

interface MemoListItemProps {
  readonly memo: MemoRecord;
  readonly task: MonitoringTask | null;
}

export function MemoListItem({ memo, task }: MemoListItemProps) {
  const guidance = useGuidance();
  const setSelectedEventId = useSetSelectedEventId();
  const updateMutation = useUpdateMemoMutation();
  const deleteMutation = useDeleteMemoMutation();

  return (
    <article className="bg-s1 border border-hair rounded-md py-3 px-3.5 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap font-mono text-[10.5px] text-ink-tertiary">
        <MemoTaskBreadcrumb taskId={memo.taskId} task={task} />
        {memo.eventId && (
          <>
            <span className="text-hair-strong">·</span>
            <Link
              to={`/tasks/${memo.taskId}`}
              onClick={() => setSelectedEventId(EventId(memo.eventId ?? ""))}
              className="text-ink-muted underline decoration-dotted underline-offset-2"
            >
              event · {memo.eventId.slice(0, 8)}…
            </Link>
          </>
        )}
      </div>
      <MemoEntryRow
        memo={memo}
        editHint={guidance.messages.memos.editDescription}
        deleteHint={guidance.messages.memos.deleteDescription}
        locale={guidance.locale}
        isUpdating={
          updateMutation.isPending && updateMutation.variables.memoId === memo.id
        }
        isDeleting={deleteMutation.isPending && deleteMutation.variables === memo.id}
        onUpdate={(body) => updateMutation.mutate({ memoId: memo.id, body: { body } })}
        onDelete={() => deleteMutation.mutate(memo.id)}
      />
    </article>
  );
}
