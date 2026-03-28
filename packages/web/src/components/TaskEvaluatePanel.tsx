import { buildReusableTaskSnapshot, buildWorkflowContext } from "@monitor/core";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { TaskEvaluationPayload, TaskEvaluationRecord } from "../api.js";
import type { TimelineEvent } from "../types.js";
import { cn } from "../lib/ui/cn.js";
import {
  buildWorkflowEvaluationData,
  createWorkflowSnapshotDraft,
  parseWorkflowSnapshotDraft,
  type WorkflowSnapshotDraft
} from "./workflowPreview.js";

interface TaskEvaluatePanelProps {
  readonly taskId?: string | null;
  readonly taskTitle: string;
  readonly taskTimeline: readonly TimelineEvent[];
  readonly evaluation: TaskEvaluationRecord | null;
  readonly isSaving: boolean;
  readonly isSaved: boolean;
  readonly onSave: (payload: TaskEvaluationPayload) => Promise<void>;
}

function WorkflowPreviewField({
  label,
  value,
  mono = false
}: {
  readonly label: string;
  readonly value: string | null;
  readonly mono?: boolean;
}): React.JSX.Element | null {
  if (!value) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">{label}</span>
      <p className={cn(
        "m-0 whitespace-pre-wrap break-words text-[0.84rem] leading-7 text-[var(--text-1)]",
        mono ? "font-mono text-[0.78rem] text-[var(--text-2)]" : ""
      )}>
        {value}
      </p>
    </div>
  );
}

function WorkflowPreviewList({
  label,
  items
}: {
  readonly label: string;
  readonly items: readonly string[];
}): React.JSX.Element | null {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">{label}</span>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <p key={item} className="m-0 whitespace-pre-wrap break-words text-[0.84rem] leading-7 text-[var(--text-1)]">
            - {item}
          </p>
        ))}
      </div>
    </div>
  );
}

export function TaskEvaluatePanel({
  taskId,
  taskTitle,
  taskTimeline,
  evaluation,
  isSaving,
  isSaved,
  onSave
}: TaskEvaluatePanelProps): React.JSX.Element {
  const [rating, setRating] = useState<"good" | "skip" | null>(null);
  const [useCase, setUseCase] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [outcomeNote, setOutcomeNote] = useState("");
  const [approachNote, setApproachNote] = useState("");
  const [reuseWhen, setReuseWhen] = useState("");
  const [watchouts, setWatchouts] = useState("");
  const [workflowSnapshotDraft, setWorkflowSnapshotDraft] = useState<WorkflowSnapshotDraft>(() =>
    createWorkflowSnapshotDraft(buildReusableTaskSnapshot({
      objective: taskTitle,
      events: taskTimeline
    }))
  );
  const [workflowContextDraft, setWorkflowContextDraft] = useState("");
  const [isSnapshotCustom, setIsSnapshotCustom] = useState(false);
  const [isWorkflowContextCustom, setIsWorkflowContextCustom] = useState(false);
  const [workflowContentMode, setWorkflowContentMode] = useState<"preview" | "edit">("preview");

  useEffect(() => {
    const initialRating = evaluation?.rating ?? null;
    const initialUseCase = evaluation?.useCase ?? "";
    const initialTags = [...(evaluation?.workflowTags ?? [])];
    const initialOutcomeNote = evaluation?.outcomeNote ?? "";
    const initialApproachNote = evaluation?.approachNote ?? "";
    const initialReuseWhen = evaluation?.reuseWhen ?? "";
    const initialWatchouts = evaluation?.watchouts ?? "";

    setRating(initialRating);
    setUseCase(initialUseCase);
    setTags(initialTags);
    setOutcomeNote(initialOutcomeNote);
    setApproachNote(initialApproachNote);
    setReuseWhen(initialReuseWhen);
    setWatchouts(initialWatchouts);
    setTagInput("");

    const initialEvaluationData = buildWorkflowEvaluationData({
      useCase: initialUseCase,
      workflowTags: initialTags,
      outcomeNote: initialOutcomeNote,
      approachNote: initialApproachNote,
      reuseWhen: initialReuseWhen,
      watchouts: initialWatchouts
    });
    const initialSnapshot = evaluation?.workflowSnapshot ?? buildReusableTaskSnapshot({
      objective: taskTitle,
      events: taskTimeline,
      evaluation: initialEvaluationData
    });
    const initialContext = evaluation?.workflowContext ?? buildWorkflowContext(
      taskTimeline,
      taskTitle,
      initialEvaluationData,
      initialSnapshot
    );

    setWorkflowSnapshotDraft(createWorkflowSnapshotDraft(initialSnapshot));
    setWorkflowContextDraft(initialContext);
    setIsSnapshotCustom(Boolean(evaluation?.workflowSnapshot));
    setIsWorkflowContextCustom(Boolean(evaluation?.workflowContext));
    setWorkflowContentMode("preview");
  }, [evaluation, taskId, taskTitle]);

  const addTag = useCallback((raw: string) => {
    const cleaned = raw.trim().replace(/,+$/, "").trim();
    if (cleaned && !tags.includes(cleaned)) {
      setTags((prev) => [...prev, cleaned]);
    }
    setTagInput("");
  }, [tags]);

  const handleTagKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "," || event.key === "Enter") {
      event.preventDefault();
      addTag(tagInput);
    } else if (event.key === "Backspace" && tagInput === "" && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }, [addTag, tagInput, tags.length]);

  const handleTagBlur = useCallback(() => {
    if (tagInput.trim()) {
      addTag(tagInput);
    }
  }, [addTag, tagInput]);

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((value) => value !== tag));
  }, []);

  const currentEvaluationData = useMemo(() => buildWorkflowEvaluationData({
    useCase,
    workflowTags: tags,
    outcomeNote,
    approachNote,
    reuseWhen,
    watchouts
  }), [approachNote, outcomeNote, reuseWhen, tags, useCase, watchouts]);

  const generatedWorkflowSnapshot = useMemo(() => buildReusableTaskSnapshot({
    objective: taskTitle,
    events: taskTimeline,
    evaluation: currentEvaluationData
  }), [currentEvaluationData, taskTimeline, taskTitle]);

  const parsedWorkflowSnapshot = useMemo(
    () => parseWorkflowSnapshotDraft(workflowSnapshotDraft),
    [workflowSnapshotDraft]
  );

  const effectiveWorkflowContext = useMemo(() => {
    const trimmed = workflowContextDraft.trim();
    if (trimmed) {
      return trimmed;
    }

    return buildWorkflowContext(
      taskTimeline,
      taskTitle,
      currentEvaluationData,
      parsedWorkflowSnapshot
    );
  }, [currentEvaluationData, parsedWorkflowSnapshot, taskTimeline, taskTitle, workflowContextDraft]);

  useEffect(() => {
    if (!isSnapshotCustom) {
      setWorkflowSnapshotDraft(createWorkflowSnapshotDraft(generatedWorkflowSnapshot));
    }
  }, [generatedWorkflowSnapshot, isSnapshotCustom]);

  useEffect(() => {
    if (!isWorkflowContextCustom) {
      setWorkflowContextDraft(buildWorkflowContext(
        taskTimeline,
        taskTitle,
        currentEvaluationData,
        parsedWorkflowSnapshot
      ));
    }
  }, [currentEvaluationData, isWorkflowContextCustom, parsedWorkflowSnapshot, taskTimeline, taskTitle]);

  const handleRegenerateWorkflowContent = useCallback(() => {
    setIsSnapshotCustom(false);
    setWorkflowSnapshotDraft(createWorkflowSnapshotDraft(generatedWorkflowSnapshot));
    setIsWorkflowContextCustom(false);
    setWorkflowContextDraft(buildWorkflowContext(
      taskTimeline,
      taskTitle,
      currentEvaluationData,
      generatedWorkflowSnapshot
    ));
  }, [currentEvaluationData, generatedWorkflowSnapshot, taskTimeline, taskTitle]);

  const updateSnapshotField = useCallback(
    <K extends keyof WorkflowSnapshotDraft>(field: K, value: WorkflowSnapshotDraft[K]) => {
      setIsSnapshotCustom(true);
      setWorkflowSnapshotDraft((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!rating) {
      return;
    }

    const workflowSnapshot = parseWorkflowSnapshotDraft(workflowSnapshotDraft);

    await onSave({
      rating,
      ...(useCase.trim() ? { useCase: useCase.trim() } : {}),
      ...(tags.length > 0 ? { workflowTags: tags } : {}),
      ...(outcomeNote.trim() ? { outcomeNote: outcomeNote.trim() } : {}),
      ...(approachNote.trim() ? { approachNote: approachNote.trim() } : {}),
      ...(reuseWhen.trim() ? { reuseWhen: reuseWhen.trim() } : {}),
      ...(watchouts.trim() ? { watchouts: watchouts.trim() } : {}),
      workflowSnapshot,
      workflowContext: effectiveWorkflowContext
    });
  }, [
    approachNote,
    effectiveWorkflowContext,
    onSave,
    outcomeNote,
    rating,
    reuseWhen,
    tags,
    useCase,
    watchouts,
    workflowSnapshotDraft
  ]);

  const labelClass = "text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]";
  const textareaClass = "rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[0.84rem] leading-6 text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)] resize-y";
  const snapshotFieldClass = "flex flex-col gap-1.5";
  const workflowContentState = isSnapshotCustom || isWorkflowContextCustom ? "Edited" : "Generated";

  return (
    <div className="flex flex-col gap-4 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
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

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Use case</span>
        <input
          className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[0.8rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
          placeholder="이 작업은 어떤 종류였나요? e.g. 타입스크립트 타입 에러 수정"
          value={useCase}
          onChange={(event) => setUseCase(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Tags</span>
        <div className="flex flex-wrap gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 focus-within:border-[var(--accent)]">
          {tags.map((tag) => (
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
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={handleTagBlur}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Outcome</span>
        <textarea
          className={textareaClass}
          placeholder="무엇이 해결됐는지 짧게 적어주세요."
          rows={3}
          value={outcomeNote}
          onChange={(event) => setOutcomeNote(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>What worked</span>
        <textarea
          className={textareaClass}
          placeholder="어떤 접근이 잘 먹혔는지 적어주세요."
          rows={3}
          value={approachNote}
          onChange={(event) => setApproachNote(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Reuse when</span>
        <textarea
          className={textareaClass}
          placeholder="어떤 상황에서 다시 쓰면 좋은지 적어주세요."
          rows={2}
          value={reuseWhen}
          onChange={(event) => setReuseWhen(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Watch out</span>
        <textarea
          className={textareaClass}
          placeholder="주의할 점을 적어주세요."
          rows={2}
          value={watchouts}
          onChange={(event) => setWatchouts(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[0.85rem] font-semibold text-[var(--text-1)]">Workflow Snapshot / Context</span>
            <p className="m-0 text-[0.76rem] leading-relaxed text-[var(--text-3)]">
              Task activity에서 자동 생성한 workflow content입니다. 저장 전에 확인하고 필요하면 수정할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              "rounded-full px-2.5 py-1 text-[0.68rem] font-semibold",
              workflowContentState === "Edited"
                ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]"
                : "bg-[var(--surface)] text-[var(--text-3)]"
            )}>
              {workflowContentState}
            </span>
            <button
              type="button"
              className={cn(
                "rounded-[7px] border px-2.5 py-1 text-[0.74rem] font-semibold transition-colors",
                workflowContentMode === "preview"
                  ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text-1)]"
              )}
              onClick={() => setWorkflowContentMode("preview")}
            >
              Preview
            </button>
            <button
              type="button"
              className={cn(
                "rounded-[7px] border px-2.5 py-1 text-[0.74rem] font-semibold transition-colors",
                workflowContentMode === "edit"
                  ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text-1)]"
              )}
              onClick={() => setWorkflowContentMode("edit")}
            >
              Edit fields
            </button>
            <button
              type="button"
              className="rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[0.74rem] font-semibold text-[var(--text-2)] transition-colors hover:text-[var(--text-1)]"
              onClick={handleRegenerateWorkflowContent}
            >
              Regenerate
            </button>
          </div>
        </div>

        {workflowContentMode === "preview" ? (
          <div className="flex flex-col gap-3">
            <WorkflowPreviewField label="Objective" value={parsedWorkflowSnapshot.objective} />
            <WorkflowPreviewField label="Original request" value={parsedWorkflowSnapshot.originalRequest} />
            <WorkflowPreviewField label="Outcome summary" value={parsedWorkflowSnapshot.outcomeSummary} />
            <WorkflowPreviewField label="Approach summary" value={parsedWorkflowSnapshot.approachSummary} />
            <WorkflowPreviewField label="Reuse when" value={parsedWorkflowSnapshot.reuseWhen} />
            <WorkflowPreviewField label="Verification summary" value={parsedWorkflowSnapshot.verificationSummary} />
            <WorkflowPreviewList label="Key decisions" items={parsedWorkflowSnapshot.keyDecisions} />
            <WorkflowPreviewList label="Next steps" items={parsedWorkflowSnapshot.nextSteps} />
            <WorkflowPreviewList label="Watch items" items={parsedWorkflowSnapshot.watchItems} />
            <WorkflowPreviewList label="Key files" items={parsedWorkflowSnapshot.keyFiles} />
            <WorkflowPreviewList label="Modified files" items={parsedWorkflowSnapshot.modifiedFiles} />
            <WorkflowPreviewField label="Search text" value={parsedWorkflowSnapshot.searchText} mono />

            <div className="flex flex-col gap-1.5">
              <span className={labelClass}>Workflow context</span>
              <pre className="m-0 max-h-[30rem] overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[0.8rem] leading-7 text-[var(--text-2)]">
                {effectiveWorkflowContext}
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className={snapshotFieldClass}>
              <span className={labelClass}>Objective</span>
              <textarea
                className={textareaClass}
                rows={3}
                value={workflowSnapshotDraft.objective}
                onChange={(event) => updateSnapshotField("objective", event.target.value)}
              />
            </div>
            <div className={snapshotFieldClass}>
              <span className={labelClass}>Original request</span>
              <textarea
                className={textareaClass}
                rows={4}
                value={workflowSnapshotDraft.originalRequest}
                onChange={(event) => updateSnapshotField("originalRequest", event.target.value)}
              />
            </div>
            <div className={snapshotFieldClass}>
              <span className={labelClass}>Outcome summary</span>
              <textarea
                className={textareaClass}
                rows={4}
                value={workflowSnapshotDraft.outcomeSummary}
                onChange={(event) => updateSnapshotField("outcomeSummary", event.target.value)}
              />
            </div>
            <div className={snapshotFieldClass}>
              <span className={labelClass}>Approach summary</span>
              <textarea
                className={textareaClass}
                rows={4}
                value={workflowSnapshotDraft.approachSummary}
                onChange={(event) => updateSnapshotField("approachSummary", event.target.value)}
              />
            </div>
            <div className={snapshotFieldClass}>
              <span className={labelClass}>Reuse when</span>
              <textarea
                className={textareaClass}
                rows={3}
                value={workflowSnapshotDraft.reuseWhen}
                onChange={(event) => updateSnapshotField("reuseWhen", event.target.value)}
              />
            </div>
            <div className={snapshotFieldClass}>
              <span className={labelClass}>Verification summary</span>
              <textarea
                className={textareaClass}
                rows={3}
                value={workflowSnapshotDraft.verificationSummary}
                onChange={(event) => updateSnapshotField("verificationSummary", event.target.value)}
              />
            </div>
            <div className={snapshotFieldClass}>
              <span className={labelClass}>Key decisions</span>
              <textarea
                className={textareaClass}
                placeholder="한 줄에 하나씩"
                rows={5}
                value={workflowSnapshotDraft.keyDecisions}
                onChange={(event) => updateSnapshotField("keyDecisions", event.target.value)}
              />
            </div>
            <div className={snapshotFieldClass}>
              <span className={labelClass}>Next steps</span>
              <textarea
                className={textareaClass}
                placeholder="한 줄에 하나씩"
                rows={5}
                value={workflowSnapshotDraft.nextSteps}
                onChange={(event) => updateSnapshotField("nextSteps", event.target.value)}
              />
            </div>
            <div className={snapshotFieldClass}>
              <span className={labelClass}>Watch items</span>
              <textarea
                className={textareaClass}
                placeholder="한 줄에 하나씩"
                rows={4}
                value={workflowSnapshotDraft.watchItems}
                onChange={(event) => updateSnapshotField("watchItems", event.target.value)}
              />
            </div>
            <div className={snapshotFieldClass}>
              <span className={labelClass}>Key files</span>
              <textarea
                className={textareaClass}
                placeholder="한 줄에 하나씩"
                rows={4}
                value={workflowSnapshotDraft.keyFiles}
                onChange={(event) => updateSnapshotField("keyFiles", event.target.value)}
              />
            </div>
            <div className={snapshotFieldClass}>
              <span className={labelClass}>Modified files</span>
              <textarea
                className={textareaClass}
                placeholder="한 줄에 하나씩"
                rows={4}
                value={workflowSnapshotDraft.modifiedFiles}
                onChange={(event) => updateSnapshotField("modifiedFiles", event.target.value)}
              />
            </div>
            <div className={snapshotFieldClass}>
              <span className={labelClass}>Search text</span>
              <textarea
                className={cn(textareaClass, "font-mono text-[0.78rem]")}
                rows={5}
                value={workflowSnapshotDraft.searchText}
                onChange={(event) => updateSnapshotField("searchText", event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className={labelClass}>Workflow context</span>
              <textarea
                className={cn(textareaClass, "min-h-[28rem] font-mono text-[0.78rem] leading-7")}
                value={workflowContextDraft}
                onChange={(event) => {
                  setIsWorkflowContextCustom(true);
                  setWorkflowContextDraft(event.target.value);
                }}
              />
            </div>
          </div>
        )}
      </div>

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
