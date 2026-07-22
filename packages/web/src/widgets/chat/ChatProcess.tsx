import { ChatMarkdown } from "~web/widgets/chat/ChatMarkdown.js";

export function ChatProcess({ content, active = false }: { readonly content: string; readonly active?: boolean }) {
  return (
    <details
      open={active || undefined}
      className="self-start max-w-[75%] rounded-md border border-hair bg-s0 px-3 py-2 text-ink-subtle"
    >
      <summary className="cursor-pointer select-none text-[11.5px] font-medium text-ink-subtle">
        {active ? "Working…" : "Process"}
      </summary>
      <div className="mt-2 border-t border-hair pt-2 text-[12px] opacity-80">
        <ChatMarkdown content={content} />
      </div>
    </details>
  );
}

export function extractProcessText(transcript: string, answer: string): string {
  const normalizedTranscript = transcript.trim();
  const normalizedAnswer = answer.trim();
  if (normalizedTranscript.length === 0 || normalizedTranscript === normalizedAnswer) return "";
  if (normalizedAnswer.length > 0 && normalizedTranscript.endsWith(normalizedAnswer)) {
    return normalizedTranscript.slice(0, -normalizedAnswer.length).trim();
  }
  return normalizedTranscript;
}
