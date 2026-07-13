import { useRef } from "react";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText, SparkleIcon, Tooltip } from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import { TitleEditor } from "~web/widgets/feed/header/title/TitleEditor.js";
import { TitleSuggestionsPopover } from "~web/widgets/feed/header/title/TitleSuggestionsPopover.js";
import { useTitleEditor } from "~web/widgets/feed/header/title/useTitleEditor.js";
import { useTitleSuggestions } from "~web/widgets/feed/header/title/useTitleSuggestions.js";

interface EditableTitleProps {
  readonly task: MonitoringTask;
}

/** 수동 제목 편집과 에이전트 제안 표면을 조립하는 태스크 제목. */
export function EditableTitle({ task }: EditableTitleProps) {
  const guidance = useGuidance();
  const editor = useTitleEditor(task);
  const suggestions = useTitleSuggestions(task);
  const sparkleRef = useRef<HTMLButtonElement>(null);

  if (editor.editing) {
    return (
      <TitleEditor
        editing
        draft={editor.draft}
        current={editor.current}
        inputRef={editor.inputRef}
        saving={editor.isPending}
        disabled={suggestions.loading}
        onDraftChange={(event) => editor.setDraft(event.target.value)}
        onKeyDown={editor.onKeyDown}
        onBlur={editor.commit}
        onStart={editor.start}
      />
    );
  }

  return (
    <div className="flex-1 min-w-0 relative">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <TitleEditor
          editing={false}
          draft={editor.draft}
          current={editor.current}
          inputRef={editor.inputRef}
          saving={editor.isPending}
          disabled={suggestions.loading}
          onDraftChange={(event) => editor.setDraft(event.target.value)}
          onKeyDown={editor.onKeyDown}
          onBlur={editor.commit}
          onStart={editor.start}
        />
        <div className="flex-none">
          <Tooltip
            content={
              <GuidanceText
                locale={guidance.locale}
                message={
                  suggestions.loading
                    ? guidance.messages.feed.suggestingTitle
                    : guidance.messages.feed.suggestBetterTitle
                }
              />
            }
            side="top"
          >
            <button
              ref={sparkleRef}
              type="button"
              onClick={suggestions.show}
              aria-label={
                suggestions.loading ? "Suggesting title…" : "Suggest title"
              }
              aria-busy={suggestions.loading}
              disabled={suggestions.loading}
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1.5 h-6 rounded-xs transition-colors duration-150 text-[11.5px] font-medium whitespace-nowrap",
                suggestions.loading
                  ? "py-0 px-2.5 w-auto border border-primary bg-primary/14 text-primary cursor-wait"
                  : "p-0 w-6 border border-hair bg-transparent text-ink-tertiary cursor-pointer hover:bg-s2",
              )}
            >
              <SparkleIcon spinning={suggestions.loading} />
              {suggestions.loading && <span>Suggesting…</span>}
            </button>
          </Tooltip>
        </div>
      </div>
      {suggestions.open && (
        <TitleSuggestionsPopover
          anchorRef={sparkleRef}
          loading={suggestions.loading}
          error={suggestions.error}
          suggestions={suggestions.suggestions}
          jobId={suggestions.jobId}
          currentTitle={suggestions.currentTitle}
          agentBackend={suggestions.agentBackend}
          onAgentBackendChange={suggestions.setAgentBackend}
          onSuggest={suggestions.suggest}
          onApply={suggestions.apply}
          onClose={suggestions.close}
        />
      )}
    </div>
  );
}
