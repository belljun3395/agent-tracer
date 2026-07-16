import type { EventId, TaskId } from "~web/shared/identity.js";
import { useEventMemosQuery } from "~web/entities/memo/api/queries.js";
import { MemoThreadList } from "~web/entities/memo/ui/MemoThreadList.js";
import { useGuidance } from "~web/shared/store/index.js";

interface EventMemoSectionProps {
  readonly taskId: TaskId;
  readonly eventId: EventId;
}

/** 이벤트 하나에 매단 메모 스레드이며, 기록이 없어도 추가할 수 있어야 하므로 검증 섹션과 달리 항상 렌더링한다. */
export function EventMemoSection({ taskId, eventId }: EventMemoSectionProps) {
  const guidance = useGuidance();
  const { data } = useEventMemosQuery(taskId, eventId);

  return (
    <section
      aria-label="Event memos"
      className="mt-3 rounded-sm border border-hair bg-s2 px-3 py-2.5"
    >
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary">
        <span>Memos</span>
        {data && data.memos.length > 0 && (
          <span className="text-ink-muted normal-case tracking-normal">
            {data.memos.length}
          </span>
        )}
      </div>
      <div className="mt-2">
        <MemoThreadList
          memos={data?.memos ?? []}
          taskId={taskId}
          eventId={eventId}
          emptyMessage={guidance.messages.memos.eventThreadEmpty}
          editHint={guidance.messages.memos.editDescription}
          deleteHint={guidance.messages.memos.deleteDescription}
          locale={guidance.locale}
          addPlaceholder="Add a memo…"
        />
      </div>
    </section>
  );
}
