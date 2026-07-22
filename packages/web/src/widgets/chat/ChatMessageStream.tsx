import { useEffect, useRef } from "react";
import type { ChatThreadId } from "~web/shared/identity.js";
import type { ChatMessageRecord } from "~web/entities/chat/model/chat.js";
import type { UseChatTurnResult } from "~web/features/chat-send/useChatTurn.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText, ScrollArea } from "~web/shared/ui/index.js";
import { ChatConfirmCard } from "~web/widgets/chat/ChatConfirmCard.js";
import { ChatMarkdown } from "~web/widgets/chat/ChatMarkdown.js";
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
  }, [
    messages.length,
    turn.assistantDraft,
    turn.toolActivity.length,
    turn.pendingConfirms.length,
    turn.queuedCount,
  ]);

  const isEmpty =
    messages.length === 0 &&
    turn.assistantDraft.length === 0 &&
    turn.toolActivity.length === 0 &&
    !turn.isStreaming;

  // 도구도 델타도 아직 없는 침묵 구간에도 살아 있음을 보이도록, 스트리밍이 시작됐지만 보여 줄 게 없을 때 진행 인디케이터를 띄운다.
  const showThinking =
    turn.isStreaming && turn.assistantDraft.length === 0 && turn.toolActivity.length === 0;

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
          <div className="self-start max-w-[75%] rounded-md px-3 py-2 bg-s1 border border-hair text-ink">
            <ChatMarkdown content={turn.assistantDraft} />
          </div>
        )}

        {showThinking && (
          <div className="self-start flex items-center gap-2 rounded-md px-3 py-2 bg-s1 border border-hair">
            <span
              aria-hidden
              className="h-[6px] w-[6px] rounded-full bg-[var(--ink-subtle)]"
              style={{ animation: "pulse 1.8s ease-in-out infinite" }}
            />
            <GuidanceText
              as="span"
              className="text-[12.5px] text-ink-subtle"
              locale={guidance.locale}
              message={guidance.messages.chat.thinking}
            />
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

        {turn.queuedCount > 0 && (
          <div className="self-center flex items-center gap-1.5 text-[12.5px] text-ink-subtle">
            <GuidanceText
              as="span"
              locale={guidance.locale}
              message={guidance.messages.chat.queuedToSend}
            />
            <span className="font-mono">{turn.queuedCount}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
