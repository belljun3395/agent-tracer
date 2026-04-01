/**
 * @module components/chat/MessageList
 *
 * 채팅 메시지 목록 컴포넌트.
 * 자동 스크롤과 스트리밍 상태 표시를 지원.
 */

import type React from "react";
import { useEffect, useRef } from "react";

import type { ChatMessage } from "../../types/chat.js";
import { cn } from "../../lib/ui/cn.js";

interface MessageListProps {
  readonly messages: readonly ChatMessage[];
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

const ROLE_STYLES = {
  user: {
    container: "ml-auto bg-[var(--accent)] text-white",
    label: "text-right text-white/70"
  },
  assistant: {
    container: "mr-auto bg-[var(--surface-2)] text-[var(--text-1)] border border-[var(--border)]",
    label: "text-[var(--text-3)]"
  },
  system: {
    container: "mx-auto bg-[var(--warn-bg)] text-[var(--warn)] border border-[var(--warn)]",
    label: "text-center text-[var(--warn)]"
  }
} as const;

function MessageBubble({ message }: { readonly message: ChatMessage }): React.JSX.Element {
  const styles = ROLE_STYLES[message.role];

  return (
    <div className={cn("flex flex-col gap-1", message.role === "user" ? "items-end" : "items-start")}>
      <span className={cn("text-[0.68rem] font-medium", styles.label)}>
        {message.role === "user" ? "You" : message.role === "assistant" ? "Assistant" : "System"}
        {" · "}
        {formatTime(message.timestamp)}
      </span>

      <div className={cn(
        "relative max-w-[85%] rounded-[12px] px-4 py-2.5 text-[0.875rem] leading-relaxed whitespace-pre-wrap break-words",
        styles.container,
        message.error && "border-[var(--err)] bg-[var(--err-bg)]"
      )}>
        {message.content || (message.isStreaming && <span className="opacity-50">…</span>)}

        {message.isStreaming && (
          <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-current opacity-60" />
        )}

        {message.error && (
          <div className="mt-2 rounded-[6px] bg-[var(--err-bg)] px-2 py-1 text-[0.75rem] text-[var(--err)]">
            {message.error}
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageList({ messages }: MessageListProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = (): void => {
      const threshold = 100;
      isNearBottomRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const messageCount = messages.length;
  const lastMessageLen = messages.at(-1)?.content.length ?? 0;
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isNearBottomRef.current) return;
    if (messageCount === 0) return;
    void lastMessageLen;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messageCount, lastMessageLen]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[0.875rem] text-[var(--text-3)]">No messages yet</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col gap-4 overflow-y-auto p-4"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}
