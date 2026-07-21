import type { ChatMessageRecord } from "~web/entities/chat/model/chat.js";
import { Pill } from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";

interface ChatMessageBubbleProps {
  readonly message: ChatMessageRecord;
}

/** 저장된 대화 메시지 한 건이며, role이 tool이면 쓰기 확인이 남긴 결과 노트다. */
export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  if (message.role === "tool") {
    return (
      <div className="self-center max-w-[80%] text-[11px] text-ink-tertiary font-mono bg-s1 border border-hair rounded-xs px-2.5 py-1.5">
        {message.content}
      </div>
    );
  }

  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 max-w-[75%]",
        isUser ? "self-end items-end" : "self-start items-start",
      )}
    >
      <div
        className={cn(
          "rounded-md px-3 py-2 text-[13px] leading-[1.55] whitespace-pre-wrap",
          isUser ? "bg-primary text-on-primary" : "bg-s1 border border-hair text-ink",
        )}
      >
        {message.content}
      </div>
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.toolCalls.map((call) => (
            <Pill key={call.id} tone="neutral">
              {call.name}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}
