import { useCallback, useEffect, useState } from "react";
import type { TaskEvaluationPayload, TaskEvaluationRecord } from "../api.js";
import { cn } from "../lib/ui/cn.js";

interface TaskEvaluatePanelProps {
  readonly evaluation: TaskEvaluationRecord | null;
  readonly isSaving: boolean;
  readonly isSaved: boolean;
  readonly onSave: (payload: TaskEvaluationPayload) => Promise<void>;
}

export function TaskEvaluatePanel({ evaluation, isSaving, isSaved, onSave }: TaskEvaluatePanelProps): React.JSX.Element {
  const [rating, setRating] = useState<"good" | "skip" | null>(null);
  const [useCase, setUseCase] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [outcomeNote, setOutcomeNote] = useState("");
  const [approachNote, setApproachNote] = useState("");
  const [reuseWhen, setReuseWhen] = useState("");
  const [watchouts, setWatchouts] = useState("");

  useEffect(() => {
    if (evaluation) {
      setRating(evaluation.rating);
      setUseCase(evaluation.useCase ?? "");
      setTags([...evaluation.workflowTags]);
      setOutcomeNote(evaluation.outcomeNote ?? "");
      setApproachNote(evaluation.approachNote ?? "");
      setReuseWhen(evaluation.reuseWhen ?? "");
      setWatchouts(evaluation.watchouts ?? "");
      setTagInput("");
      return;
    }

    setRating(null);
    setUseCase("");
    setTags([]);
    setOutcomeNote("");
    setApproachNote("");
    setReuseWhen("");
    setWatchouts("");
    setTagInput("");
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
    await onSave({
      rating,
      ...(useCase.trim() ? { useCase: useCase.trim() } : {}),
      ...(tags.length > 0 ? { workflowTags: tags } : {}),
      ...(outcomeNote.trim() ? { outcomeNote: outcomeNote.trim() } : {}),
      ...(approachNote.trim() ? { approachNote: approachNote.trim() } : {}),
      ...(reuseWhen.trim() ? { reuseWhen: reuseWhen.trim() } : {}),
      ...(watchouts.trim() ? { watchouts: watchouts.trim() } : {})
    });
  }, [rating, useCase, tags, outcomeNote, approachNote, reuseWhen, watchouts, onSave]);

  const labelClass = "text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]";

  return (
    <div className="flex flex-col gap-4 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-[0.85rem] font-semibold text-[var(--text-1)]">Evaluate Workflow</span>
        {evaluation && (
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[0.68rem] font-semibold",
            evaluation.rating === "good"
              ? "bg-[var(--ok-bg)] text-[var(--ok)]"
              : "bg-[var(--surface-2)] text-[var(--text-3)]"
          )}>
            {evaluation.rating === "good" ? "Good example" : "Skip"}
          </span>
        )}
      </div>

      {/* Rating */}
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Rating</span>
        <div className="flex gap-2">
          <button
            type="button"
            className={cn(
              "rounded-[7px] border px-3 py-1.5 text-[0.78rem] font-semibold transition-colors",
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
              "rounded-[7px] border px-3 py-1.5 text-[0.78rem] font-semibold transition-colors",
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

      {/* Outcome */}
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Outcome</span>
        <textarea
          className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[0.8rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)] resize-none"
          placeholder="무엇이 해결됐는지 짧게 적어주세요. e.g. copy for ai를 compact/standard/full handoff로 정리"
          rows={3}
          value={outcomeNote}
          onChange={e => setOutcomeNote(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>What worked</span>
        <textarea
          className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[0.8rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)] resize-none"
          placeholder="어떤 접근이 잘 먹혔는지 적어주세요. e.g. shared task snapshot을 만들고 handoff/search 둘 다 거기서 생성"
          rows={3}
          value={approachNote}
          onChange={e => setApproachNote(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Reuse when</span>
        <textarea
          className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[0.8rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)] resize-none"
          placeholder="어떤 상황에서 다시 쓰면 좋은지 적어주세요. e.g. handoff가 길어지고 workflow search 정확도가 떨어질 때"
          rows={2}
          value={reuseWhen}
          onChange={e => setReuseWhen(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Watch out</span>
        <textarea
          className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[0.8rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)] resize-none"
          placeholder="주의할 점을 적어주세요. e.g. 기존 evaluation row와 migration, 긴 assistant.response를 그대로 searchText에 넣지 않기"
          rows={2}
          value={watchouts}
          onChange={e => setWatchouts(e.target.value)}
        />
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!rating || isSaving}
          className={cn(
            "rounded-[7px] border px-4 py-1.5 text-[0.78rem] font-semibold transition-all",
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
  );
}
