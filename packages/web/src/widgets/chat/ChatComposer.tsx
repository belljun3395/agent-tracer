import { useState } from "react";
import { Button, Input } from "~web/shared/ui/index.js";

interface ChatComposerProps {
  readonly isStreaming: boolean;
  readonly onSend: (content: string) => void;
  readonly onStop: () => void;
}

/** 스트리밍 중에도 열려 있는 하단 입력창으로, 보내면 진행 중인 턴을 끊고 새 턴을 시작하고(stop-and-send) Stop으로는 보내지 않고 현재 턴만 취소한다. */
export function ChatComposer({ isStreaming, onSend, onStop }: ChatComposerProps) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    onSend(trimmed);
    setDraft("");
  };

  return (
    <form
      className="flex items-center gap-2 p-3 border-t border-hair shrink-0"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Input
        className="flex-1"
        placeholder="Message the agent…"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
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
