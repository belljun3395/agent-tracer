import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReusableTaskSnapshot } from "@monitor/core";
import type { HandoffMode, TaskProcessSection } from "@monitor/web-core";
import { buildHandoffPlain, buildHandoffMarkdown, buildHandoffXML, buildHandoffSystemPrompt } from "@monitor/web-core";
import { copyToClipboard } from "../lib/ui/clipboard.js";
import { cn } from "../lib/ui/cn.js";
import { loadHandoffDraft, saveHandoffDraft, type HandoffFormat, type HandoffPrefs } from "../lib/ui/handoffStorage.js";
import { Button } from "./ui/Button.js";
import { Eyebrow } from "./ui/Eyebrow.js";
import { Textarea } from "./ui/Textarea.js";
interface TaskHandoffPanelProps {
    readonly taskId?: string;
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
const toggleButtonBaseClass = "rounded-[6px] px-2.5 py-1 text-[0.72rem] font-medium transition-colors";
const toggleButtonInactiveClass = "text-[var(--text-2)] hover:text-[var(--text-1)]";
const chipBaseClass = "rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[0.73rem] cursor-pointer select-none transition-colors";
const chipActiveClass = "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]";
function SectionLabel({ children }: {
    readonly children: React.ReactNode;
}): React.JSX.Element {
    return <Eyebrow className="text-[0.72rem] tracking-[0.06em]">{children}</Eyebrow>;
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
export function TaskHandoffPanel({ taskId, objective, summary, plans, sections, exploredFiles, modifiedFiles, openTodos, openQuestions, violations, snapshot }: TaskHandoffPanelProps): React.JSX.Element {
    const initialDraft = useMemo(() => loadHandoffDraft(taskId, violations.length), [taskId, violations.length]);
    const [isOpen, setIsOpen] = useState(false);
    const [memo, setMemo] = useState(initialDraft.memo);
    const [copied, setCopied] = useState(false);
    const [prefs, setPrefs] = useState<HandoffPrefs>(initialDraft.prefs);
    const [lastCopiedText, setLastCopiedText] = useState<string | null>(initialDraft.lastCopiedText);
    const [lastCopiedAt, setLastCopiedAt] = useState<string | null>(initialDraft.lastCopiedAt);
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
            mode: prefs.mode,
            memo,
            include: prefs.include
        };
        switch (prefs.format) {
            case "plain": return buildHandoffPlain(options);
            case "markdown": return buildHandoffMarkdown(options);
            case "xml": return buildHandoffXML(options);
            case "system-prompt": return buildHandoffSystemPrompt(options);
        }
    }, [prefs.format, prefs.include, prefs.mode, objective, summary, plans, sections, exploredFiles, modifiedFiles, openTodos, openQuestions, violations, snapshot, memo]);
    const isDisabled = !prefs.include.summary &&
        !prefs.include.plans &&
        !prefs.include.process &&
        !prefs.include.files &&
        !prefs.include.modifiedFiles &&
        !prefs.include.todos &&
        !prefs.include.violations &&
        !prefs.include.questions &&
        memo.trim() === "";
    const handleCopy = useCallback((text: string): void => {
        void copyToClipboard(text).then(() => {
            setLastCopiedText(text);
            setLastCopiedAt(new Date().toISOString());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, []);
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
        { key: "violations", label: "Violations" },
        { key: "questions", label: "Questions" }
    ];
    const formats: {
        value: HandoffFormat;
        label: string;
    }[] = [
        { value: "plain", label: "Plain" },
        { value: "markdown", label: "Markdown" },
        { value: "xml", label: "XML" },
        { value: "system-prompt", label: "SP" }
    ];
    const modes: {
        value: HandoffMode;
        label: string;
    }[] = [
        { value: "compact", label: "Compact" },
        { value: "standard", label: "Standard" },
        { value: "full", label: "Full" }
    ];
    const canCopyLast = Boolean(lastCopiedText && lastCopiedText !== preview);
    return (<div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)]">
      <button className="flex w-full items-center gap-2 px-3 py-2.5 text-left" onClick={() => setIsOpen((v) => !v)} type="button">
        <span className={cn("inline-block text-[0.75rem] text-[var(--text-3)] transition-transform duration-150", isOpen ? "rotate-0" : "-rotate-90")}>
          ▼
        </span>
        <span className="text-[0.82rem] font-semibold text-[var(--text-1)]">Copy for AI</span>
      </button>

      {isOpen && (<div className="flex flex-col gap-3 border-t border-[var(--border)] px-3 py-3">
          <div className={panelSectionClass}>
            <SectionLabel>Include</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {includeItems.map(({ key, label }) => (<IncludeChip key={key} checked={prefs.include[key]} label={label} onChange={() => toggleInclude(key)}/>))}
            </div>
          </div>

          <div className={panelSectionClass}>
            <SectionLabel>Handoff note</SectionLabel>
            <Textarea className="resize-none rounded-[6px] bg-[var(--surface-2)] px-2.5 py-1.5 text-[0.8rem]" placeholder="Add a note for the next session…" rows={2} value={memo} onChange={(e) => setMemo(e.target.value)}/>
          </div>

          <div className={panelSectionClass}>
            <SectionLabel>Mode</SectionLabel>
            <ToggleGroup options={modes} value={prefs.mode} onChange={setMode}/>
          </div>

          <div className={panelSectionClass}>
            <SectionLabel>Format</SectionLabel>
            <ToggleGroup options={formats} value={prefs.format} onChange={setFormat}/>
          </div>

          <div className={panelSectionClass}>
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>Preview</SectionLabel>
              <div className="flex items-center gap-2 text-[0.7rem] text-[var(--text-3)]">
                {lastCopiedAt ? <span>Last copy saved locally</span> : null}
                <span>{preview.length} chars</span>
              </div>
            </div>
            <pre className="max-h-48 overflow-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] p-2 font-mono text-[0.72rem] text-[var(--text-1)] whitespace-pre">
              {preview
                ? preview
                : <span className="text-[var(--text-3)]">Nothing to preview — enable at least one section.</span>}
            </pre>
          </div>

          <div className="flex justify-end gap-2">
            {canCopyLast && lastCopiedText ? (<Button className="rounded-[7px] bg-[var(--surface-2)] px-3 py-1.5 text-[0.78rem] font-semibold text-[var(--text-2)]" size="sm" type="button" onClick={() => handleCopy(lastCopiedText)}>
                Copy last
              </Button>) : null}
            <button className={cn("rounded-[7px] border px-3 py-1.5 text-[0.78rem] font-semibold transition-all", copied
                ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
                : isDisabled
                    ? "cursor-not-allowed border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-3)] opacity-50"
                    : "border-[var(--accent)] bg-[var(--accent)] text-[#fff] hover:opacity-90")} disabled={isDisabled} type="button" onClick={() => handleCopy(preview)}>
              {copied ? "Copied ✓" : "Copy for AI"}
            </button>
          </div>
        </div>)}
    </div>);
}
