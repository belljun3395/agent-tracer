/**
 * @module components/chat/MessageInput
 *
 * 메시지 입력 컴포넌트.
 * 텍스트 입력과 전송 버튼.
 */

import type React from "react";
import { useRef, useState } from "react";

import { cn } from "../../lib/ui/cn.js";
import { Button } from "../ui/Button.js";

interface MessageInputProps {
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly onSend: (message: string) => void;
}

export function MessageInput({
  disabled = false,
  placeholder = "Type a message…",
  onSend
}: MessageInputProps): React.JSX.Element {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (): void => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setValue("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const textarea = event.target;
    setValue(textarea.value);

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={textareaRef}
        className={cn(
          "flex-1 resize-none rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[0.875rem] text-[var(--text-1)] outline-none transition",
          "placeholder:text-[var(--text-3)]",
          "focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
        disabled={disabled}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        value={value}
      />

      <Button
        disabled={disabled || !value.trim()}
        onClick={handleSubmit}
        size="md"
        variant="ghost"
        className={cn(
          "h-11 px-4",
          !disabled && value.trim() && "border-[var(--accent)] bg-[var(--accent)] text-white hover:bg-[var(--accent)] hover:opacity-90"
        )}
      >
        Send
      </Button>
    </div>
  );
}
