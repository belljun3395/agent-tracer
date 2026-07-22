import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";

interface ChatComposerProps {
  readonly isStreaming: boolean;
  readonly onSend: (content: string) => void;
  readonly onStop: () => void;
}

/** 스트리밍 중에도 열려 있는 하단 입력창으로, 보내면 진행 중인 턴이 있을 때 취소 대신 대기열에 쌓고(queue) 유휴면 곧바로 새 턴을 시작하며, Stop은 보내지 않고 현재 턴을 취소하고 대기열도 비운다. */
export function ChatComposer({ isStreaming, onSend, onStop }: ChatComposerProps) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composingRef = useRef(false);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draft]);

  const submit = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    onSend(trimmed);
    setDraft("");
    textareaRef.current?.focus();
  };

  return (
    <form
      className="flex items-center gap-2 p-3 border-t border-hair shrink-0"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        className={cn(
          "flex-1 min-h-9 max-h-40 resize-none overflow-y-auto rounded-md border border-hair bg-s1",
          "px-3 py-2 text-[13px] leading-5 text-ink outline-none placeholder:text-ink-tertiary",
          "focus:border-primary focus:ring-1 focus:ring-primary",
        )}
        placeholder="Message the agent…"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          if (composingRef.current || event.nativeEvent.isComposing) return;
          event.preventDefault();
          submit();
        }}
        aria-label="Message"
      />
      {isStreaming && (
        <Button type="button" variant="ghost" onClick={onStop} aria-label="Stop">
          Stop
        </Button>
      )}
      <Button type="submit" variant="primary" disabled={draft.trim().length === 0}>
        Send
      </Button>
    </form>
  );
}
