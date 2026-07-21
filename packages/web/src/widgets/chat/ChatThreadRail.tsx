import type { ChatThreadId } from "~web/shared/identity.js";
import type { ChatThreadRecord } from "~web/entities/chat/model/chat.js";
import { useCreateThreadMutation } from "~web/entities/chat/api/mutations.js";
import { useGuidance } from "~web/shared/store/index.js";
import { Button, GuidanceText, ScrollArea } from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";

const DEFAULT_THREAD_TITLE = "New conversation";

interface ChatThreadRailProps {
  readonly threads: readonly ChatThreadRecord[];
  readonly selectedThreadId: ChatThreadId | null;
  readonly onSelect: (threadId: ChatThreadId) => void;
  readonly onCreated: (threadId: ChatThreadId) => void;
}

/** 스레드 목록과 새 대화 시작 액션을 보여 주는 왼쪽 레일이다. */
export function ChatThreadRail({ threads, selectedThreadId, onSelect, onCreated }: ChatThreadRailProps) {
  const guidance = useGuidance();
  const createMutation = useCreateThreadMutation();

  const handleCreate = () => {
    createMutation.mutate(
      { title: DEFAULT_THREAD_TITLE },
      { onSuccess: (res) => onCreated(res.thread.id) },
    );
  };

  return (
    <aside className="w-[220px] shrink-0 border-r border-hair flex flex-col min-h-0">
      <div className="p-2.5 border-b border-hair">
        <Button
          variant="primary"
          className="w-full text-center"
          onClick={handleCreate}
          disabled={createMutation.isPending}
        >
          + New
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-0.5 p-1.5">
          {threads.length === 0 && (
            <GuidanceText
              as="p"
              className="text-[11.5px] text-ink-subtle text-center py-6 px-2"
              locale={guidance.locale}
              message={guidance.messages.chat.threadsEmpty}
            />
          )}
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => onSelect(thread.id)}
              aria-current={thread.id === selectedThreadId ? "page" : undefined}
              className={cn(
                "text-left rounded-xs px-2.5 py-2 text-[12.5px] truncate transition-colors",
                thread.id === selectedThreadId
                  ? "bg-s1 text-ink"
                  : "text-ink-muted hover:bg-s1 hover:text-ink",
              )}
            >
              {thread.title}
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
