import { useCallback, useEffect, useMemo, useState } from "react";
import { TaskId, type ReusableTaskSnapshot } from "@monitor/core";
import type { HandoffMode, HandoffPurpose, TaskProcessSection } from "@monitor/web-domain";
import { buildHandoffPlain, buildHandoffMarkdown, buildHandoffXML, buildHandoffSystemPrompt, buildHandoffPrompt } from "@monitor/web-domain";
import { fetchTaskBriefings, recordBriefingCopy, saveTaskBriefing, type SavedBriefingRecord } from "@monitor/web-io";
import { copyToClipboard } from "../lib/ui/clipboard.js";
import { cn } from "../lib/ui/cn.js";
import { loadHandoffDraft, saveHandoffDraft, type HandoffFormat, type HandoffPrefs } from "../lib/ui/handoffStorage.js";
import { Button } from "./ui/Button.js";
import { Eyebrow } from "./ui/Eyebrow.js";
import { Textarea } from "./ui/Textarea.js";
interface TaskHandoffPanelProps {
    readonly taskId?: string;
    readonly scopeKey?: string;
    readonly objective: string;
    readonly summary: string;
    readonly plans: readonly string[];
    readonly sections: readonly TaskProcessSection[];
    readonly exploredFiles: readonly string[];
    readonly modifiedFiles: readonly string[];
    readonly openTodos: readonly string[];
    readonly openQuestions: readonly string[];
    readonly violations: readonly string[];
    readonly snapshot: ReusableTaskSnapshot;
}
const panelSectionClass = "flex flex-col gap-1.5";
const toggleButtonBaseClass = "rounded-[var(--radius-md)] px-2 py-0.75 text-[0.68rem] font-medium transition-colors";
const toggleButtonInactiveClass = "text-[var(--text-2)] hover:text-[var(--text-1)]";
const chipBaseClass = "rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[0.68rem] cursor-pointer select-none transition-colors";
const chipActiveClass = "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]";
const purposeOptions: readonly {
    readonly value: HandoffPurpose;
    readonly label: string;
}[] = [
    { value: "continue", label: "Continue" },
    { value: "handoff", label: "Handoff" },
    { value: "review", label: "Review" },
    { value: "reference", label: "Reference" }
] as const;
const formatOptions: readonly {
    readonly value: HandoffFormat;
    readonly label: string;
}[] = [
    { value: "plain", label: "Plain" },
    { value: "markdown", label: "Markdown" },
    { value: "xml", label: "XML" },
    { value: "system-prompt", label: "SP" },
    { value: "prompt", label: "Prompt" }
] as const;
const modeOptions: readonly {
    readonly value: HandoffMode;
    readonly label: string;
}[] = [
    { value: "compact", label: "Compact" },
    { value: "standard", label: "Standard" },
    { value: "full", label: "Full" }
] as const;
function formatSavedTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function SectionLabel({ children }: {
    readonly children: React.ReactNode;
}): React.JSX.Element {
    return <Eyebrow className="text-[0.68rem] tracking-[0.06em]">{children}</Eyebrow>;
}
function ToggleGroup<T extends string>({ options, value, onChange }: {
    readonly options: readonly {
        readonly value: T;
        readonly label: string;
    }[];
    readonly value: T;
    readonly onChange: (value: T) => void;
}): React.JSX.Element {
    return (<div className="flex w-fit overflow-hidden rounded-[6px] border border-[var(--border)]">
      {options.map((option) => (<button key={option.value} className={cn(toggleButtonBaseClass, value === option.value
                ? "bg-[var(--accent)] text-[#fff]"
                : toggleButtonInactiveClass)} type="button" onClick={() => onChange(option.value)}>
          {option.label}
        </button>))}
    </div>);
}
function IncludeChip({ checked, label, onChange }: {
    readonly checked: boolean;
    readonly label: string;
    readonly onChange: () => void;
}): React.JSX.Element {
    return (<label className={cn(chipBaseClass, "has-[:checked]:" + chipActiveClass, checked && chipActiveClass)}>
      <input checked={checked} className="sr-only" type="checkbox" onChange={onChange}/>
      {label}
    </label>);
}
export function TaskHandoffPanel({ taskId, scopeKey, objective, summary, plans, sections, exploredFiles, modifiedFiles, openTodos, openQuestions, violations, snapshot }: TaskHandoffPanelProps): React.JSX.Element {
    const initialDraft = useMemo(() => loadHandoffDraft(taskId, violations.length), [taskId, violations.length]);
    const [isOpen, setIsOpen] = useState(false);
    const [memo, setMemo] = useState(initialDraft.memo);
    const [copied, setCopied] = useState(false);
    const [prefs, setPrefs] = useState<HandoffPrefs>(initialDraft.prefs);
    const [lastCopiedText, setLastCopiedText] = useState<string | null>(initialDraft.lastCopiedText);
    const [lastCopiedAt, setLastCopiedAt] = useState<string | null>(initialDraft.lastCopiedAt);
    const [savedBriefings, setSavedBriefings] = useState<readonly SavedBriefingRecord[]>([]);
    const [isLoadingSavedBriefings, setIsLoadingSavedBriefings] = useState(false);
    const [isSavingBriefing, setIsSavingBriefing] = useState(false);
    useEffect(() => {
        const draft = loadHandoffDraft(taskId, violations.length);
        setMemo(draft.memo);
        setPrefs(draft.prefs);
        setLastCopiedText(draft.lastCopiedText);
        setLastCopiedAt(draft.lastCopiedAt);
        setCopied(false);
    }, [taskId, violations.length]);
    useEffect(() => {
        saveHandoffDraft(taskId, {
            prefs,
            memo,
            lastCopiedText,
            lastCopiedAt
        });
    }, [lastCopiedAt, lastCopiedText, memo, prefs, taskId]);
    useEffect(() => {
        if (!isOpen || !taskId) {
            return;
        }
        setIsLoadingSavedBriefings(true);
        void fetchTaskBriefings(TaskId(taskId))
            .then((items) => setSavedBriefings(items))
            .catch(() => setSavedBriefings([]))
            .finally(() => setIsLoadingSavedBriefings(false));
    }, [isOpen, taskId]);
    const preview = useMemo(() => {
        const options = {
            objective,
            summary,
            plans,
            sections,
            exploredFiles,
            modifiedFiles,
            openTodos,
            openQuestions,
            violations,
            snapshot,
            purpose: prefs.purpose,
            mode: prefs.mode,
            memo,
            include: prefs.include
        };
        switch (prefs.format) {
            case "plain": return buildHandoffPlain(options);
            case "markdown": return buildHandoffMarkdown(options);
            case "xml": return buildHandoffXML(options);
            case "system-prompt": return buildHandoffSystemPrompt(options);
            case "prompt": return buildHandoffPrompt(options);
            default: return buildHandoffPlain(options);
        }
    }, [prefs.format, prefs.include, prefs.mode, prefs.purpose, objective, summary, plans, sections, exploredFiles, modifiedFiles, openTodos, openQuestions, violations, snapshot, memo]);
    const isDisabled = preview.trim().length === 0;
    const handleCopy = useCallback((text: string): void => {
        void copyToClipboard(text).then(() => {
            setLastCopiedText(text);
            setLastCopiedAt(new Date().toISOString());
            setCopied(true);
            if (taskId) {
                void recordBriefingCopy(TaskId(taskId), scopeKey).catch(() => {
                    void 0;
                });
            }
            setTimeout(() => setCopied(false), 2000);
        });
    }, [scopeKey, taskId]);
    const handleSaveBriefing = useCallback((): void => {
        if (!taskId || !preview.trim()) {
            return;
        }
        setIsSavingBriefing(true);
        const generatedAt = new Date().toISOString();
        void saveTaskBriefing(TaskId(taskId), {
            purpose: prefs.purpose,
            format: prefs.format,
            ...(memo.trim() ? { memo: memo.trim() } : {}),
            content: preview,
            generatedAt
        })
            .then((saved) => {
            setSavedBriefings((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        })
            .finally(() => setIsSavingBriefing(false));
    }, [memo, prefs.format, prefs.purpose, preview, taskId]);
    const toggleInclude = useCallback((key: keyof HandoffPrefs["include"]): void => {
        setPrefs({
            ...prefs,
            include: { ...prefs.include, [key]: !prefs.include[key] }
        });
    }, [prefs]);
    const setFormat = useCallback((format: HandoffFormat): void => {
        setPrefs({ ...prefs, format });
    }, [prefs]);
    const setMode = useCallback((mode: HandoffMode): void => {
        setPrefs({ ...prefs, mode });
    }, [prefs]);
    const setPurpose = useCallback((purpose: HandoffPurpose): void => {
        setPrefs({ ...prefs, purpose });
    }, [prefs]);
    const includeItems: {
        key: keyof HandoffPrefs["include"];
        label: string;
    }[] = [
        { key: "summary", label: "Summary" },
        { key: "plans", label: "Plan" },
        { key: "process", label: "Process" },
        { key: "files", label: "Files" },
        { key: "modifiedFiles", label: "Modified" },
        { key: "todos", label: "TODOs" },
        { key: "violations", label: "Watchouts" },
        { key: "questions", label: "Questions" }
    ];
    const canCopyLast = Boolean(lastCopiedText && lastCopiedText !== preview);
    const scopeLabel = useMemo(() => {
        if (!scopeKey || scopeKey === "task") {
            return null;
        }
        const turnMatch = /^turn:(\d+)$/.exec(scopeKey);
        if (turnMatch) {
            return `Turn ${turnMatch[1]}`;
        }
        return scopeKey;
    }, [scopeKey]);
    return (<div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-1)]">
      <button className="flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => setIsOpen((v) => !v)} type="button">
        <span className={cn("inline-block text-[0.72rem] text-[var(--text-3)] transition-transform duration-150", isOpen ? "rotate-0" : "-rotate-90")}>
          ▼
        </span>
        <span className="text-[0.78rem] font-semibold text-[var(--text-1)]">Generate Briefing</span>
        {scopeLabel ? <span className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[0.64rem] font-medium text-[var(--text-2)]">{scopeLabel}</span> : null}
      </button>

      {isOpen && (<div className="flex flex-col gap-3 border-t border-[var(--border)] px-3 py-2.5">
          <div className="flex flex-col gap-1">
            <span className="text-[0.74rem] text-[var(--text-2)]">Generate a structured context packet for AI or human handoff.</span>
          </div>

          <div className={panelSectionClass}>
            <SectionLabel>Briefing purpose</SectionLabel>
            <ToggleGroup options={purposeOptions} value={prefs.purpose} onChange={setPurpose}/>
          </div>

          <div className={panelSectionClass}>
            <SectionLabel>Include</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {includeItems.map(({ key, label }) => (<IncludeChip key={key} checked={prefs.include[key]} label={label} onChange={() => toggleInclude(key)}/>))}
            </div>
          </div>

          <div className={panelSectionClass}>
            <SectionLabel>Memo</SectionLabel>
            <Textarea className="resize-none rounded-[var(--radius-md)] bg-[var(--surface-2)] text-[0.78rem]" placeholder="Add context the recipient should know…" rows={2} value={memo} onChange={(e) => setMemo(e.target.value)}/>
          </div>

          <div className={panelSectionClass}>
            <SectionLabel>Detail level</SectionLabel>
            <ToggleGroup options={modeOptions} value={prefs.mode} onChange={setMode}/>
          </div>

          <div className={panelSectionClass}>
            <SectionLabel>Output format</SectionLabel>
            <ToggleGroup options={formatOptions} value={prefs.format} onChange={setFormat}/>
          </div>

          <div className={panelSectionClass}>
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>Briefing Preview</SectionLabel>
              <div className="flex items-center gap-2 text-[0.66rem] text-[var(--text-3)]">
                {lastCopiedAt ? <span>Last copy saved locally</span> : null}
                <span>{preview.length} chars</span>
              </div>
            </div>
            <pre className="max-h-48 overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-2.5 font-mono text-[0.68rem] text-[var(--text-1)] whitespace-pre">
              {preview
                ? preview
                : <span className="text-[var(--text-3)]">Nothing to preview yet.</span>}
            </pre>
          </div>

          <div className="flex justify-end gap-2">
            {canCopyLast && lastCopiedText ? (<Button size="sm" variant="ghost" type="button" onClick={() => handleCopy(lastCopiedText)}>
                Copy prev
              </Button>) : null}
            {taskId ? (<Button size="sm" variant="ghost" type="button" disabled={isSavingBriefing || isDisabled} onClick={handleSaveBriefing}>
                {isSavingBriefing ? "Saving…" : "Save"}
              </Button>) : null}
            <Button
              size="sm"
              variant="bare"
              className={cn(
                "border",
                copied
                  ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)] hover:text-[var(--ok)]"
                  : "border-[var(--accent)] bg-[var(--accent)] text-[#fff] hover:text-[#fff] hover:opacity-90"
              )}
              disabled={isDisabled}
              type="button"
              onClick={() => handleCopy(preview)}
            >
              {copied ? "Copied ✓" : "Copy"}
            </Button>
          </div>

          {taskId ? (<div className={panelSectionClass}>
              <div className="flex items-center justify-between gap-3">
                <SectionLabel>Saved briefings</SectionLabel>
                {isLoadingSavedBriefings ? <span className="text-[0.7rem] text-[var(--text-3)]">Loading…</span> : null}
              </div>
              {savedBriefings.length === 0 ? (<div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[0.72rem] text-[var(--text-3)]">
                  No saved briefings yet.
                </div>) : (<div className="flex max-h-40 flex-col gap-2 overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-2">
                  {savedBriefings.map((briefing) => (<div key={briefing.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="text-[0.72rem] font-semibold text-[var(--text-1)]">
                            {briefing.purpose} · {briefing.format}
                          </span>
                          <span className="text-[0.66rem] text-[var(--text-3)]">{formatSavedTime(briefing.generatedAt)}</span>
                          {briefing.memo ? <span className="line-clamp-1 text-[0.68rem] text-[var(--text-2)]">{briefing.memo}</span> : null}
                        </div>
                        <Button size="sm" className="px-2 text-[0.68rem]" onClick={() => handleCopy(briefing.content)}>Copy</Button>
                      </div>
                    </div>))}
                </div>)}
            </div>) : null}
        </div>)}
    </div>);
}
