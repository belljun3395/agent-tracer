import { useEffect, useRef } from "react";
import type { ChatThreadId } from "~web/shared/identity.js";
import type { ChatMessageRecord } from "~web/entities/chat/model/chat.js";
import type { UseChatTurnResult } from "~web/features/chat-send/useChatTurn.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText, ScrollArea } from "~web/shared/ui/index.js";
import { ChatConfirmCard } from "~web/widgets/chat/ChatConfirmCard.js";
import { ChatMemoryUpdatePill } from "~web/widgets/chat/ChatMemoryUpdatePill.js";
import { ChatMessageBubble } from "~web/widgets/chat/ChatMessageBubble.js";
import { ChatToolCallChip } from "~web/widgets/chat/ChatToolCallChip.js";

interface ChatMessageStreamProps {
  readonly threadId: ChatThreadId;
  readonly messages: readonly ChatMessageRecord[];
  readonly turn: UseChatTurnResult;
}

/** 저장된 메시지와, 진행 중인 턴의 실시간 델타·도구·확인·기억 갱신을 한 흐름으로 보여 준다. */
export function ChatMessageStream({ threadId, messages, turn }: ChatMessageStreamProps) {
  const guidance = useGuidance();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, turn.assistantDraft, turn.toolActivity.length, turn.pendingConfirms.length]);

  const isEmpty =
    messages.length === 0 &&
    turn.assistantDraft.length === 0 &&
    turn.toolActivity.length === 0 &&
    !turn.isStreaming;

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="flex flex-col gap-3 p-4">
        {isEmpty && (
          <GuidanceText
            as="p"
            className="text-[12.5px] text-ink-subtle text-center py-8"
            locale={guidance.locale}
            message={guidance.messages.chat.conversationEmpty}
          />
        )}

        {messages.map((message) => (
          <ChatMessageBubble key={message.id} message={message} />
        ))}

        {turn.toolActivity.length > 0 && (
          <div className="self-start flex flex-wrap gap-1.5">
            {turn.toolActivity.map((activity) => (
              <ChatToolCallChip key={activity.call.id} activity={activity} />
            ))}
          </div>
        )}

        {turn.assistantDraft.length > 0 && (
          <div className="self-start max-w-[75%] rounded-md px-3 py-2 text-[13px] leading-[1.55] whitespace-pre-wrap bg-s1 border border-hair text-ink">
            {turn.assistantDraft}
          </div>
        )}

        {turn.memoryUpdates.map((update, index) => (
          <ChatMemoryUpdatePill key={`${update.key}-${index}`} update={update} />
        ))}

        {turn.pendingConfirms.map((request) => (
          <ChatConfirmCard
            key={request.id}
            threadId={threadId}
            request={request}
            onResolved={turn.dismissConfirm}
          />
        ))}

        {turn.error && (
          <GuidanceText
            as="p"
            className="text-[12.5px] text-err text-center"
            locale={guidance.locale}
            message={guidance.messages.chat.streamError}
          />
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
