import { Fragment, useEffect, useRef, useState } from "react";
import type { ChatThreadId } from "~web/shared/identity.js";
import type { ChatMessageRecord } from "~web/entities/chat/model/chat.js";
import type { UseChatTurnResult } from "~web/features/chat-send/useChatTurn.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText, ScrollArea } from "~web/shared/ui/index.js";
import { ChatConfirmCard } from "~web/widgets/chat/ChatConfirmCard.js";
import { ChatProcess, extractProcessText } from "~web/widgets/chat/ChatProcess.js";
import { ChatMessageBubble } from "~web/widgets/chat/ChatMessageBubble.js";

interface ChatMessageStreamProps {
  readonly threadId: ChatThreadId;
  readonly messages: readonly ChatMessageRecord[];
  readonly turn: UseChatTurnResult;
}

/** 저장된 메시지와, 진행 중인 턴의 실시간 델타·도구·확인·기억 갱신을 한 흐름으로 보여 준다. */
export function ChatMessageStream({
  threadId,
  messages,
  turn,
}: ChatMessageStreamProps) {
  const guidance = useGuidance();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const followTailRef = useRef(true);
  const [hasNewContentBelow, setHasNewContentBelow] = useState(false);

  useEffect(() => {
    followTailRef.current = true;
    setHasNewContentBelow(false);
  }, [threadId]);

  useEffect(() => {
    if (followTailRef.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
      setHasNewContentBelow(false);
    } else {
      setHasNewContentBelow(true);
    }
  }, [
    messages.length,
    turn.pendingMessages,
    turn.activeProcess,
    turn.pendingConfirms.length,
    turn.queuedCount,
    threadId,
  ]);

  const isEmpty =
    messages.length === 0 &&
    turn.pendingMessages.length === 0 &&
    turn.activeProcess.length === 0 &&
    !turn.isStreaming;

  // 도구도 델타도 아직 없는 침묵 구간에도 살아 있음을 보이도록, 스트리밍이 시작됐지만 보여 줄 게 없을 때 진행 인디케이터를 띄운다.
  const showThinking =
    turn.isStreaming && turn.activeProcess.length === 0;

  const jumpToLatest = () => {
    followTailRef.current = true;
    setHasNewContentBelow(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  return (
    <div className="relative flex-1 min-h-0">
      <ScrollArea
        className="h-full"
        viewportRef={viewportRef}
        onViewportScroll={(event) => {
          const viewport = event.currentTarget;
          const distance =
            viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
          followTailRef.current = distance <= 64;
          if (followTailRef.current) setHasNewContentBelow(false);
        }}
      >
        <div className="flex flex-col gap-3 p-4">
          {isEmpty && (
            <GuidanceText
              as="p"
              className="text-[12.5px] text-ink-subtle text-center py-8"
              locale={guidance.locale}
              message={guidance.messages.chat.conversationEmpty}
            />
          )}

          {messages.map((message) => {
            const transcript = turn.completedProcesses.find(
              (process) => process.assistantMessageId === message.id,
            )?.transcript;
            const process = transcript ? extractProcessText(transcript, message.content) : "";
            return (
              <Fragment key={message.id}>
                {process.length > 0 && <ChatProcess content={process} />}
                <ChatMessageBubble message={message} />
              </Fragment>
            );
          })}

          {turn.pendingMessages.map((pending) => (
            <div key={pending.clientRequestId} className={pending.status === "failed" ? "contents" : "contents opacity-70"}>
              <ChatMessageBubble message={optimisticUserMessage(threadId, pending.clientRequestId, pending.content)} />
              {pending.status === "failed" && (
                <div className="self-end flex items-center gap-2 text-[11.5px] text-err" role="alert">
                  <span>{pending.error ?? "Message was not sent"}</span>
                  <button type="button" className="underline" onClick={() => turn.retryMessage(pending.clientRequestId)}>Retry</button>
                  <button type="button" className="underline" onClick={() => turn.dismissMessage(pending.clientRequestId)}>Delete</button>
                </div>
              )}
            </div>
          ))}

          {turn.activeProcess.length > 0 && (
            <ChatProcess content={turn.activeProcess} active />
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
      {hasNewContentBelow && (
        <button
          type="button"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-hair bg-s1 px-3 py-1.5 text-[12px] text-ink shadow-sm"
          onClick={jumpToLatest}
        >
          Jump to latest
        </button>
      )}
    </div>
  );
}

function optimisticUserMessage(
  threadId: ChatThreadId,
  suffix: string,
  content: string,
): ChatMessageRecord {
  return {
    id: `optimistic-${suffix}`,
    threadId,
    role: "user",
    content,
    toolCalls: null,
    toolCallId: null,
    createdAt: "",
  };
}
