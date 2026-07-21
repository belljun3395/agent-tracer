import { useState } from "react";
import type { ChatThreadId } from "~web/shared/identity.js";
import {
  chatThreadDisplayTitle,
  DEFAULT_CHAT_THREAD_TITLE,
  type ChatThreadRecord,
} from "~web/entities/chat/model/chat.js";
import {
  useCreateThreadMutation,
  useDeleteThreadMutation,
} from "~web/entities/chat/api/mutations.js";
import { useGuidance } from "~web/shared/store/index.js";
import { Button, GuidanceText, IconButton, Modal, ScrollArea, TrashIcon } from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";

interface ChatThreadRailProps {
  readonly threads: readonly ChatThreadRecord[];
  readonly selectedThreadId: ChatThreadId | null;
  readonly onSelect: (threadId: ChatThreadId) => void;
  readonly onCreated: (threadId: ChatThreadId) => void;
  readonly onDeleted: (threadId: ChatThreadId) => void;
}

/** 스레드 목록과 새 대화 시작 액션을 보여 주는 왼쪽 레일이다. */
export function ChatThreadRail({
  threads,
  selectedThreadId,
  onSelect,
  onCreated,
  onDeleted,
}: ChatThreadRailProps) {
  const guidance = useGuidance();
  const createMutation = useCreateThreadMutation();
  const deleteMutation = useDeleteThreadMutation();

  const handleCreate = () => {
    createMutation.mutate(
      { title: DEFAULT_CHAT_THREAD_TITLE },
      { onSuccess: (res) => onCreated(res.thread.id) },
    );
  };

  const handleDelete = (threadId: ChatThreadId) => {
    deleteMutation.mutate(threadId, { onSuccess: () => onDeleted(threadId) });
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
            <ThreadRow
              key={thread.id}
              thread={thread}
              selected={thread.id === selectedThreadId}
              onSelect={onSelect}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

interface ThreadRowProps {
  readonly thread: ChatThreadRecord;
  readonly selected: boolean;
  readonly onSelect: (threadId: ChatThreadId) => void;
  readonly onDelete: (threadId: ChatThreadId) => void;
}

function ThreadRow({ thread, selected, onSelect, onDelete }: ThreadRowProps) {
  const guidance = useGuidance();
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className={cn(
        "group flex items-center rounded-xs transition-colors",
        selected ? "bg-s1 text-ink" : "text-ink-muted hover:bg-s1 hover:text-ink",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(thread.id)}
        aria-current={selected ? "page" : undefined}
        className="flex-1 min-w-0 text-left px-2.5 py-2 text-[12.5px] truncate"
      >
        {chatThreadDisplayTitle(thread)}
      </button>
      <IconButton
        tone="danger"
        aria-label="Delete conversation"
        onClick={(event) => {
          event.stopPropagation();
          setConfirming(true);
        }}
        className={cn(
          "mr-1.5 shrink-0 border-transparent text-ink-tertiary hover:text-err",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          selected && "opacity-100",
        )}
      >
        <TrashIcon />
      </IconButton>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete conversation"
        description={guidance.messages.chat.deleteConfirm}
        descriptionLocale={guidance.locale}
        maxWidth={380}
      >
        <div className="flex justify-end gap-2 p-4">
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            variant="solid"
            className="bg-err border-err text-on-primary"
            onClick={() => {
              setConfirming(false);
              onDelete(thread.id);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
