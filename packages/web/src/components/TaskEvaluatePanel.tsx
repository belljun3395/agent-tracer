import { buildReusableTaskSnapshot, buildWorkflowContext } from "@monitor/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TimelineEvent } from "@monitor/web-domain";
import { fetchSimilarWorkflows, type TaskEvaluationPayload, type TaskEvaluationRecord, type WorkflowSearchResultRecord } from "@monitor/web-io";
import { cn } from "../lib/ui/cn.js";
import { buildWorkflowEvaluationData, createWorkflowSnapshotDraft, parseWorkflowSnapshotDraft, type WorkflowSnapshotDraft } from "./workflowPreview.js";
import { Badge } from "./ui/Badge.js";
import { Button } from "./ui/Button.js";
import { Eyebrow } from "./ui/Eyebrow.js";
import { Input } from "./ui/Input.js";
import { Textarea } from "./ui/Textarea.js";
interface TaskEvaluatePanelProps {
    readonly taskId?: string | null;
    readonly taskTitle: string;
    readonly taskTimeline: readonly TimelineEvent[];
    readonly evaluation: TaskEvaluationRecord | null;
    readonly isSaving: boolean;
    readonly isSaved: boolean;
    readonly onSave: (payload: TaskEvaluationPayload) => Promise<void>;
}
const fieldClass = "flex flex-col gap-1.5";
const snapshotFieldClass = "flex flex-col gap-1.5";
function SectionLabel({ children }: {
    readonly children: React.ReactNode;
}): React.JSX.Element {
    return <Eyebrow className="text-[0.68rem] tracking-[0.06em]">{children}</Eyebrow>;
}
function TextareaField({ label, value, rows, placeholder, onChange }: {
    readonly label: string;
    readonly value: string;
    readonly rows: number;
    readonly placeholder?: string;
    readonly onChange: (value: string) => void;
}): React.JSX.Element {
    return (<div className={fieldClass}>
      <SectionLabel>{label}</SectionLabel>
      <Textarea className="resize-y" placeholder={placeholder} rows={rows} value={value} onChange={(event) => onChange(event.target.value)}/>
    </div>);
}
function ModeButton({ active, children, onClick }: {
    readonly active: boolean;
    readonly children: React.ReactNode;
    readonly onClick: () => void;
}): React.JSX.Element {
    return (<button type="button" className={cn("rounded-[var(--radius-md)] border px-2.5 py-1 text-[0.74rem] font-semibold transition-colors", active
            ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
            : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text-1)]")} onClick={onClick}>
      {children}
    </button>);
}
function WorkflowPreviewField({ label, value, mono = false }: {
    readonly label: string;
    readonly value: string | null;
    readonly mono?: boolean;
}): React.JSX.Element | null {
    if (!value) {
        return null;
    }
    return (<div className="flex flex-col gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
      <Eyebrow>{label}</Eyebrow>
      <p className={cn("m-0 whitespace-pre-wrap break-words text-[0.8rem] leading-6 text-[var(--text-1)]", mono ? "font-mono text-[0.76rem] text-[var(--text-2)]" : "")}>
        {value}
      </p>
    </div>);
}
function WorkflowPreviewList({ label, items }: {
    readonly label: string;
    readonly items: readonly string[];
}): React.JSX.Element | null {
    if (items.length === 0) {
        return null;
    }
    return (<div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
      <Eyebrow>{label}</Eyebrow>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (<p key={item} className="m-0 whitespace-pre-wrap break-words text-[0.8rem] leading-6 text-[var(--text-1)]">
            - {item}
          </p>))}
      </div>
    </div>);
}
export function TaskEvaluatePanel({ taskId, taskTitle, taskTimeline, evaluation, isSaving, isSaved, onSave }: TaskEvaluatePanelProps): React.JSX.Element {
    const [rating, setRating] = useState<"good" | "skip" | null>(null);
    const [useCase, setUseCase] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [outcomeNote, setOutcomeNote] = useState("");
    const [approachNote, setApproachNote] = useState("");
    const [reuseWhen, setReuseWhen] = useState("");
    const [watchouts, setWatchouts] = useState("");
    const [workflowSnapshotDraft, setWorkflowSnapshotDraft] = useState<WorkflowSnapshotDraft>(() => createWorkflowSnapshotDraft(buildReusableTaskSnapshot({
        objective: taskTitle,
        events: taskTimeline
    })));
    const [workflowContextDraft, setWorkflowContextDraft] = useState("");
    const [isSnapshotCustom, setIsSnapshotCustom] = useState(false);
    const [isWorkflowContextCustom, setIsWorkflowContextCustom] = useState(false);
    const [workflowContentMode, setWorkflowContentMode] = useState<"preview" | "edit">("preview");
    const [similarWorkflows, setSimilarWorkflows] = useState<readonly WorkflowSearchResultRecord[]>([]);
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
        const initialContext = evaluation?.workflowContext ?? buildWorkflowContext(taskTimeline, taskTitle, initialEvaluationData, initialSnapshot);
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
        }
        else if (event.key === "Backspace" && tagInput === "" && tags.length > 0) {
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
    const parsedWorkflowSnapshot = useMemo(() => parseWorkflowSnapshotDraft(workflowSnapshotDraft), [workflowSnapshotDraft]);
    const effectiveWorkflowContext = useMemo(() => {
        const trimmed = workflowContextDraft.trim();
        if (trimmed) {
            return trimmed;
        }
        return buildWorkflowContext(taskTimeline, taskTitle, currentEvaluationData, parsedWorkflowSnapshot);
    }, [currentEvaluationData, parsedWorkflowSnapshot, taskTimeline, taskTitle, workflowContextDraft]);
    useEffect(() => {
        if (!isSnapshotCustom) {
            setWorkflowSnapshotDraft(createWorkflowSnapshotDraft(generatedWorkflowSnapshot));
        }
    }, [generatedWorkflowSnapshot, isSnapshotCustom]);
    useEffect(() => {
        if (!isWorkflowContextCustom) {
            setWorkflowContextDraft(buildWorkflowContext(taskTimeline, taskTitle, currentEvaluationData, parsedWorkflowSnapshot));
        }
    }, [currentEvaluationData, isWorkflowContextCustom, parsedWorkflowSnapshot, taskTimeline, taskTitle]);
    useEffect(() => {
        const query = parsedWorkflowSnapshot.searchText.trim();
        if (!query || rating !== "good") {
            setSimilarWorkflows([]);
            return;
        }
        const timer = setTimeout(() => {
            void fetchSimilarWorkflows(query, tags, 3)
                .then((results) => setSimilarWorkflows(results.filter((result) => result.taskId !== taskId)))
                .catch(() => setSimilarWorkflows([]));
        }, 180);
        return (): void => clearTimeout(timer);
    }, [parsedWorkflowSnapshot.searchText, rating, tags, taskId]);
    const handleRegenerateWorkflowContent = useCallback(() => {
        setIsSnapshotCustom(false);
        setWorkflowSnapshotDraft(createWorkflowSnapshotDraft(generatedWorkflowSnapshot));
        setIsWorkflowContextCustom(false);
        setWorkflowContextDraft(buildWorkflowContext(taskTimeline, taskTitle, currentEvaluationData, generatedWorkflowSnapshot));
    }, [currentEvaluationData, generatedWorkflowSnapshot, taskTimeline, taskTitle]);
    const updateSnapshotField = useCallback(<K extends keyof WorkflowSnapshotDraft>(field: K, value: WorkflowSnapshotDraft[K]) => {
        setIsSnapshotCustom(true);
        setWorkflowSnapshotDraft((prev) => ({ ...prev, [field]: value }));
    }, []);
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
    const workflowContentState = isSnapshotCustom || isWorkflowContextCustom ? "Edited" : "Generated";
    return (<div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3.5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[0.82rem] font-semibold text-[var(--text-1)]">Save to Library</span>
        {evaluation && (<Badge className="px-2 py-0.5 text-[0.68rem]" tone={evaluation.rating === "good" ? "success" : "neutral"}>
            {evaluation.rating === "good" ? "Worth reusing" : "Not reusable"}
          </Badge>)}
        </div>
        <p className="m-0 text-[0.74rem] leading-relaxed text-[var(--text-3)]">
          Capture this task as a reusable workflow snapshot.
        </p>
      </div>

      <div className={fieldClass}>
        <SectionLabel>Was this workflow worth reusing?</SectionLabel>
        <div className="flex gap-2">
          <button type="button" className={cn("rounded-[var(--radius-md)] border px-2.5 py-1.25 text-[0.74rem] font-semibold transition-colors", rating === "good"
            ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
            : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text-1)]")} onClick={() => setRating("good")}>
            Reuse
          </button>
          <button type="button" className={cn("rounded-[var(--radius-md)] border px-2.5 py-1.25 text-[0.74rem] font-semibold transition-colors", rating === "skip"
            ? "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-1)]"
            : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text-2)]")} onClick={() => setRating("skip")}>
            Skip
          </button>
        </div>
      </div>

      <div className={fieldClass}>
        <SectionLabel>Use case</SectionLabel>
        <Input placeholder="What kind of task was this? e.g. TypeScript type error fix" value={useCase} onChange={(event) => setUseCase(event.target.value)}/>
      </div>

      <div className={fieldClass}>
        <SectionLabel>Tags</SectionLabel>
        <div className="flex flex-wrap gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 focus-within:border-[var(--accent)]">
          {tags.map((tag) => (<span key={tag} className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 text-[0.68rem] text-[var(--accent)]">
              {tag}
              <button type="button" className="hover:text-[var(--text-1)]" onClick={() => removeTag(tag)}>
                ×
              </button>
            </span>))}
          <input className="min-w-[80px] flex-1 bg-transparent text-[0.78rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)]" placeholder={tags.length === 0 ? "typescript, bug-fix, refactor…" : ""} value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={handleTagKeyDown} onBlur={handleTagBlur}/>
        </div>
      </div>

      <TextareaField label="Outcome" placeholder="Summarize what this task resolved." rows={3} value={outcomeNote} onChange={setOutcomeNote}/>
      <TextareaField label="What worked" placeholder="Describe what worked well." rows={3} value={approachNote} onChange={setApproachNote}/>
      <TextareaField label="Reuse when" placeholder="Describe when this workflow should be reused." rows={2} value={reuseWhen} onChange={setReuseWhen}/>
      <TextareaField label="Watch out" placeholder="List any watchouts for future runs." rows={2} value={watchouts} onChange={setWatchouts}/>

      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[0.82rem] font-semibold text-[var(--text-1)]">Snapshot Preview</span>
            <p className="m-0 text-[0.74rem] leading-relaxed text-[var(--text-3)]">
              This snapshot is generated from task activity. Review it before saving and edit any field that needs to be clearer.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="px-2 py-0.75 text-[0.64rem]" tone={workflowContentState === "Edited" ? "accent" : "neutral"}>
              {workflowContentState}
            </Badge>
            <ModeButton active={workflowContentMode === "preview"} onClick={() => setWorkflowContentMode("preview")}>Preview</ModeButton>
            <ModeButton active={workflowContentMode === "edit"} onClick={() => setWorkflowContentMode("edit")}>Edit</ModeButton>
            <Button size="sm" variant="ghost" onClick={handleRegenerateWorkflowContent}>
              Regenerate
            </Button>
          </div>
        </div>

        {workflowContentMode === "preview" ? (<div className="flex flex-col gap-3">
            <WorkflowPreviewField label="Objective" value={parsedWorkflowSnapshot.objective}/>
            <WorkflowPreviewField label="Original request" value={parsedWorkflowSnapshot.originalRequest}/>
            <WorkflowPreviewField label="Outcome summary" value={parsedWorkflowSnapshot.outcomeSummary}/>
            <WorkflowPreviewField label="Approach summary" value={parsedWorkflowSnapshot.approachSummary}/>
            <WorkflowPreviewField label="Reuse when" value={parsedWorkflowSnapshot.reuseWhen}/>
            <WorkflowPreviewField label="Verification summary" value={parsedWorkflowSnapshot.verificationSummary}/>
            <WorkflowPreviewList label="Key decisions" items={parsedWorkflowSnapshot.keyDecisions}/>
            <WorkflowPreviewList label="Next steps" items={parsedWorkflowSnapshot.nextSteps}/>
            <WorkflowPreviewList label="Watch items" items={parsedWorkflowSnapshot.watchItems}/>
            <WorkflowPreviewList label="Key files" items={parsedWorkflowSnapshot.keyFiles}/>
            <WorkflowPreviewList label="Modified files" items={parsedWorkflowSnapshot.modifiedFiles}/>
            <WorkflowPreviewField label="Search text" value={parsedWorkflowSnapshot.searchText} mono/>

            <div className={fieldClass}>
              <SectionLabel>Workflow context</SectionLabel>
              <pre className="m-0 max-h-[30rem] overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[0.76rem] leading-6 text-[var(--text-2)]">
                {effectiveWorkflowContext}
              </pre>
            </div>
          </div>) : (<div className="flex flex-col gap-3">
            <div className={snapshotFieldClass}>
              <SectionLabel>Objective</SectionLabel>
              <Textarea className="resize-y" rows={3} value={workflowSnapshotDraft.objective} onChange={(event) => updateSnapshotField("objective", event.target.value)}/>
            </div>
            <div className={snapshotFieldClass}>
              <SectionLabel>Original request</SectionLabel>
              <Textarea className="resize-y" rows={4} value={workflowSnapshotDraft.originalRequest} onChange={(event) => updateSnapshotField("originalRequest", event.target.value)}/>
            </div>
            <div className={snapshotFieldClass}>
              <SectionLabel>Outcome summary</SectionLabel>
              <Textarea className="resize-y" rows={4} value={workflowSnapshotDraft.outcomeSummary} onChange={(event) => updateSnapshotField("outcomeSummary", event.target.value)}/>
            </div>
            <div className={snapshotFieldClass}>
              <SectionLabel>Approach summary</SectionLabel>
              <Textarea className="resize-y" rows={4} value={workflowSnapshotDraft.approachSummary} onChange={(event) => updateSnapshotField("approachSummary", event.target.value)}/>
            </div>
            <div className={snapshotFieldClass}>
              <SectionLabel>Reuse when</SectionLabel>
              <Textarea className="resize-y" rows={3} value={workflowSnapshotDraft.reuseWhen} onChange={(event) => updateSnapshotField("reuseWhen", event.target.value)}/>
            </div>
            <div className={snapshotFieldClass}>
              <SectionLabel>Verification summary</SectionLabel>
              <Textarea className="resize-y" rows={3} value={workflowSnapshotDraft.verificationSummary} onChange={(event) => updateSnapshotField("verificationSummary", event.target.value)}/>
            </div>
            <div className={snapshotFieldClass}>
              <SectionLabel>Key decisions</SectionLabel>
              <Textarea className="resize-y" placeholder="One item per line" rows={5} value={workflowSnapshotDraft.keyDecisions} onChange={(event) => updateSnapshotField("keyDecisions", event.target.value)}/>
            </div>
            <div className={snapshotFieldClass}>
              <SectionLabel>Next steps</SectionLabel>
              <Textarea className="resize-y" placeholder="One item per line" rows={5} value={workflowSnapshotDraft.nextSteps} onChange={(event) => updateSnapshotField("nextSteps", event.target.value)}/>
            </div>
            <div className={snapshotFieldClass}>
              <SectionLabel>Watch items</SectionLabel>
              <Textarea className="resize-y" placeholder="One item per line" rows={4} value={workflowSnapshotDraft.watchItems} onChange={(event) => updateSnapshotField("watchItems", event.target.value)}/>
            </div>
            <div className={snapshotFieldClass}>
              <SectionLabel>Key files</SectionLabel>
              <Textarea className="resize-y" placeholder="One item per line" rows={4} value={workflowSnapshotDraft.keyFiles} onChange={(event) => updateSnapshotField("keyFiles", event.target.value)}/>
            </div>
            <div className={snapshotFieldClass}>
              <SectionLabel>Modified files</SectionLabel>
              <Textarea className="resize-y" placeholder="One item per line" rows={4} value={workflowSnapshotDraft.modifiedFiles} onChange={(event) => updateSnapshotField("modifiedFiles", event.target.value)}/>
            </div>
            <div className={snapshotFieldClass}>
              <SectionLabel>Search text</SectionLabel>
              <Textarea className="resize-y font-mono text-[0.76rem]" rows={5} value={workflowSnapshotDraft.searchText} onChange={(event) => updateSnapshotField("searchText", event.target.value)}/>
            </div>

            <div className={fieldClass}>
              <SectionLabel>Workflow context</SectionLabel>
              <Textarea className="min-h-[28rem] font-mono text-[0.76rem] leading-6 resize-y" value={workflowContextDraft} onChange={(event) => {
                    setIsWorkflowContextCustom(true);
                    setWorkflowContextDraft(event.target.value);
                }}/>
            </div>
          </div>)}
      </div>

      {similarWorkflows.length > 0 ? (<div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--warn)_35%,var(--border))] bg-[color-mix(in_srgb,var(--warn)_10%,var(--surface))] px-3 py-2.5">
          <div className="flex flex-col gap-1">
            <span className="text-[0.78rem] font-semibold text-[var(--text-1)]">Similar knowledge already exists</span>
            <span className="text-[0.74rem] leading-relaxed text-[var(--text-2)]">
              Consider updating an existing snapshot instead of saving a duplicate.
            </span>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {similarWorkflows.map((workflow) => (<div key={workflow.taskId} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge tone="accent" size="xs">Snapshot</Badge>
                  <span className="text-[0.76rem] font-semibold text-[var(--text-1)]">{workflow.displayTitle ?? workflow.title}</span>
                </div>
                {workflow.useCase ? <div className="mt-1 text-[0.72rem] text-[var(--text-2)]">{workflow.useCase}</div> : null}
              </div>))}
          </div>
        </div>) : null}

      <div className="flex justify-end">
        <Button
          disabled={!rating || isSaving}
          size="sm"
          variant="bare"
          className={cn(
            "border px-3",
            isSaved
              ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)] hover:text-[var(--ok)]"
              : "border-[var(--accent)] bg-[var(--accent)] text-[#fff] hover:text-[#fff] hover:opacity-90"
          )}
          onClick={() => { void handleSave(); }}
        >
          {isSaved ? "Saved ✓" : isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>);
}
