import { useCallback, useEffect, useState } from "react";
import { useEvaluation } from "../store/useEvaluation.js";
import { cn } from "../lib/ui/cn.js";

interface TaskEvaluatePanelProps {
  readonly taskId: string;
}

export function TaskEvaluatePanel({ taskId }: TaskEvaluatePanelProps): React.JSX.Element {
  const { evaluation, isSaving, isSaved, saveEvaluation } = useEvaluation(taskId);
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState<"good" | "skip" | null>(null);
  const [useCase, setUseCase] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [outcomeNote, setOutcomeNote] = useState("");

  // 기존 평가가 로드되면 폼에 채우기
  useEffect(() => {
    if (evaluation) {
      setRating(evaluation.rating);
      setUseCase(evaluation.useCase ?? "");
      setTags(evaluation.workflowTags);
      setOutcomeNote(evaluation.outcomeNote ?? "");
    }
  }, [evaluation]);

  const addTag = useCallback((raw: string) => {
    const cleaned = raw.trim().replace(/,+$/, "").trim();
    if (cleaned && !tags.includes(cleaned)) {
      setTags(prev => [...prev, cleaned]);
    }
    setTagInput("");
  }, [tags]);

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
  }, [tagInput, tags, addTag]);

  const handleTagBlur = useCallback(() => {
    if (tagInput.trim()) addTag(tagInput);
  }, [tagInput, addTag]);

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  }, []);

  const handleSave = useCallback(async () => {
    if (!rating) return;
    await saveEvaluation({
      rating,
      ...(useCase.trim() ? { useCase: useCase.trim() } : {}),
      ...(tags.length > 0 ? { workflowTags: tags } : {}),
      ...(outcomeNote.trim() ? { outcomeNote: outcomeNote.trim() } : {})
    });
  }, [rating, useCase, tags, outcomeNote, saveEvaluation]);

  const labelClass = "text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]";

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)]">
      {/* Accordion header */}
      <button
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => setIsOpen(v => !v)}
        type="button"
      >
        <span
          className="text-[0.75rem] text-[var(--text-3)] transition-transform duration-150"
          style={{ display: "inline-block", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          ▼
        </span>
        <span className="text-[0.82rem] font-semibold text-[var(--text-1)]">Evaluate Workflow</span>
        {evaluation && (
          <span className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-[0.68rem] font-semibold",
            evaluation.rating === "good"
              ? "bg-[var(--ok-bg)] text-[var(--ok)]"
              : "bg-[var(--surface-2)] text-[var(--text-3)]"
          )}>
            {evaluation.rating === "good" ? "Good example" : "Skip"}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] px-3 py-3">

          {/* Rating */}
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Rating</span>
            <div className="flex gap-2">
              <button
                type="button"
                className={cn(
                  "rounded-[7px] border px-3 py-1 text-[0.78rem] font-semibold transition-colors",
                  rating === "good"
                    ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
                    : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text-1)]"
                )}
                onClick={() => setRating("good")}
              >
                Good example
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-[7px] border px-3 py-1 text-[0.78rem] font-semibold transition-colors",
                  rating === "skip"
                    ? "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-1)]"
                    : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text-2)]"
                )}
                onClick={() => setRating("skip")}
              >
                Skip
              </button>
            </div>
          </div>

          {/* Use case */}
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Use case</span>
            <input
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[0.8rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
              placeholder="이 작업은 어떤 종류였나요? e.g. 타입스크립트 타입 에러 수정"
              value={useCase}
              onChange={e => setUseCase(e.target.value)}
            />
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Tags</span>
            <div className="flex flex-wrap gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 focus-within:border-[var(--accent)]">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full border border-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 text-[0.72rem] text-[var(--accent)]"
                >
                  {tag}
                  <button
                    type="button"
                    className="hover:text-[var(--text-1)]"
                    onClick={() => removeTag(tag)}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                className="min-w-[80px] flex-1 bg-transparent text-[0.8rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)]"
                placeholder={tags.length === 0 ? "typescript, bug-fix, refactor…" : ""}
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={handleTagBlur}
              />
            </div>
          </div>

          {/* Outcome note */}
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Outcome note</span>
            <textarea
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[0.8rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)] resize-none"
              placeholder="다음번에 도움이 될 힌트는? e.g. satisfies operator가 as보다 효과적"
              rows={2}
              value={outcomeNote}
              onChange={e => setOutcomeNote(e.target.value)}
            />
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!rating || isSaving}
              className={cn(
                "rounded-[7px] border px-3 py-1.5 text-[0.78rem] font-semibold transition-all",
                isSaved
                  ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
                  : !rating || isSaving
                    ? "cursor-not-allowed border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-3)] opacity-50"
                    : "border-[var(--accent)] bg-[var(--accent)] text-[#fff] hover:opacity-90"
              )}
              onClick={() => { void handleSave(); }}
            >
              {isSaved ? "Saved ✓" : isSaving ? "Saving…" : "Save evaluation"}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
