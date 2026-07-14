import { useEffect } from "react";
import type { TitleSuggestion } from "~web/entities/job/model/title-suggestion.js";
import { useGuidance } from "~web/shared/store/index.js";
import { AnchoredPopover, GuidanceText } from "~web/shared/ui/index.js";
import {
  AgentBackendSelect,
  type AgentBackendChoice,
} from "~web/features/agent-backend-select/AgentBackendSelect.js";
import { cn } from "~web/shared/ui/lib/cn.js";

interface TitleSuggestionsPopoverProps {
  readonly anchorRef: { readonly current: HTMLElement | null };
  readonly loading: boolean;
  readonly error: string | null;
  readonly suggestions: readonly TitleSuggestion[];
  readonly currentTitle: string;
  readonly agentBackend: AgentBackendChoice;
  readonly onAgentBackendChange: (backend: AgentBackendChoice) => void;
  readonly onSuggest: () => void;
  readonly onApply: (title: string) => void;
  readonly onClose: () => void;
}

/** 제목 제안 생성 옵션과 후보 및 잡 피드백을 표시한다. */
export function TitleSuggestionsPopover({
  anchorRef,
  loading,
  error,
  suggestions,
  currentTitle,
  agentBackend,
  onAgentBackendChange,
  onSuggest,
  onApply,
  onClose,
}: TitleSuggestionsPopoverProps) {
  const guidance = useGuidance();

  useEffect(() => {
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <AnchoredPopover
      anchorRef={anchorRef}
      preferredWidth={520}
      preferredMaxHeight={480}
      role="dialog"
      aria-label="Title suggestions"
      className="bg-s1 border border-hair rounded-sm shadow-[0_12px_32px_-8px_rgba(0,0,0,0.45)] p-2.5"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-ink-tertiary uppercase tracking-[0.04em]">
          Suggested titles
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="bg-transparent border-none text-ink-tertiary cursor-pointer text-sm leading-none"
        >
          ×
        </button>
      </div>
      <div className="mb-2 flex min-w-0 items-center gap-2">
        <AgentBackendSelect
          value={agentBackend}
          onChange={onAgentBackendChange}
          disabled={loading}
          className="min-w-0 flex-1 text-[11.5px]"
        />
        <button
          type="button"
          onClick={onSuggest}
          disabled={loading}
          className={cn(
            "shrink-0 rounded-xs border px-2.5 py-1.5 text-[11.5px] font-medium",
            loading
              ? "cursor-wait border-hair bg-s2 text-ink-subtle"
              : "cursor-pointer border-primary bg-primary text-canvas",
          )}
        >
          {loading ? "Suggesting…" : "Generate title suggestions"}
        </button>
      </div>
      {loading && (
        <GuidanceText
          as="p"
          className="m-0 text-xs text-ink-subtle"
          locale={guidance.locale}
          message={guidance.messages.feed.suggestingTitle}
        />
      )}
      {error && (
        <p className="m-0 text-xs text-err [overflow-wrap:anywhere]">
          {error}
        </p>
      )}
      {!loading && !error && suggestions.length === 0 && (
        <GuidanceText
          as="p"
          className="m-0 text-xs text-ink-subtle"
          locale={guidance.locale}
          message={guidance.messages.feed.currentTitleFine}
        />
      )}
      <ul className="list-none p-0 m-0 grid gap-1.5">
        {suggestions.map((suggestion, index) => (
          <li key={`${index}-${suggestion.title}`} className="min-w-0">
            <button
              type="button"
              onClick={() => onApply(suggestion.title)}
              disabled={suggestion.title === currentTitle}
              className={cn(
                "block w-full text-left py-1.5 px-2 rounded-xs border border-hair bg-s2 text-ink text-[12.5px] font-medium leading-[1.35] [overflow-wrap:anywhere]",
                suggestion.title === currentTitle
                  ? "cursor-default"
                  : "cursor-pointer",
              )}
            >
              <div>{suggestion.title}</div>
              <div className="text-[11px] font-normal text-ink-tertiary mt-0.5 leading-[1.4]">
                {suggestion.rationale}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </AnchoredPopover>
  );
}
