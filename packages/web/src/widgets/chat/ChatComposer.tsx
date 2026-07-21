import { useState } from "react";
import { Button, Input } from "~web/shared/ui/index.js";

interface ChatComposerProps {
  readonly disabled: boolean;
  readonly onSend: (content: string) => void;
}

/** 하단에 고정된 입력창과 전송 버튼이다. */
export function ChatComposer({ disabled, onSend }: ChatComposerProps) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || disabled) return;
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
        disabled={disabled}
        aria-label="Message"
      />
      <Button type="submit" variant="primary" disabled={disabled || draft.trim().length === 0}>
        Send
      </Button>
    </form>
  );
}
