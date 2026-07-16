import type { TaskId } from "~web/shared/identity.js";
import { useTaskMemosQuery } from "~web/entities/memo/api/queries.js";
import { MemoThreadList } from "~web/entities/memo/ui/MemoThreadList.js";
import { useGuidance } from "~web/shared/store/index.js";

interface TaskMemoThreadProps {
  readonly taskId: TaskId;
}

/** 태스크 헤더의 "Details & Memo" 패널이 보여주는 태스크 수준 메모 스레드다. */
export function TaskMemoThread({ taskId }: TaskMemoThreadProps) {
  const guidance = useGuidance();
  const { data, isLoading } = useTaskMemosQuery(taskId);

  if (isLoading) {
    return <p className="m-0 text-[11.5px] text-ink-subtle">Loading memos…</p>;
  }

  return (
    <MemoThreadList
      memos={data?.memos ?? []}
      taskId={taskId}
      emptyMessage={guidance.messages.memos.taskThreadEmpty}
      editHint={guidance.messages.memos.editDescription}
      deleteHint={guidance.messages.memos.deleteDescription}
      locale={guidance.locale}
      addPlaceholder="Add a memo…"
    />
  );
}
