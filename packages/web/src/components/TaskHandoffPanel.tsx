import { useCallback, useMemo, useState } from "react";
import type { ReusableTaskSnapshot } from "@monitor/core";
import type { HandoffMode, TaskProcessSection } from "../lib/insights.js";
import {
  buildHandoffPlain,
  buildHandoffMarkdown,
  buildHandoffXML,
  buildHandoffSystemPrompt
} from "../lib/insights.js";
import { copyToClipboard } from "../lib/ui/clipboard.js";
import { cn } from "../lib/ui/cn.js";

// ── Types ────────────────────────────────────────────────────────────────────

type HandoffFormat = "plain" | "markdown" | "xml" | "system-prompt";

interface HandoffPrefs {
  format: HandoffFormat;
  mode: HandoffMode;
  include: {
    summary: boolean;
    plans: boolean;
    process: boolean;
    files: boolean;
    modifiedFiles: boolean;
    todos: boolean;
    violations: boolean;
    questions: boolean;
  };
}

const DEFAULT_HANDOFF_PREFS: HandoffPrefs = {
  format: "markdown",
  mode: "compact",
  include: {
    summary: true,
    plans: true,
    process: true,
    files: true,
    modifiedFiles: true,
    todos: true,
    violations: true,
    questions: false
  }
};

const STORAGE_KEY = "agent-tracer.handoff-prefs";

function loadPrefs(violationCount: number): HandoffPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HandoffPrefs>;
      return {
        ...DEFAULT_HANDOFF_PREFS,
        ...parsed,
        include: { ...DEFAULT_HANDOFF_PREFS.include, ...(parsed.include ?? {}) }
      };
    }
  } catch {
    // malformed JSON
  }
  return { ...DEFAULT_HANDOFF_PREFS, include: { ...DEFAULT_HANDOFF_PREFS.include, violations: violationCount > 0 } };
}

function savePrefs(prefs: HandoffPrefs): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface TaskHandoffPanelProps {
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

// ── Component ─────────────────────────────────────────────────────────────────

export function TaskHandoffPanel({
  objective,
  summary,
  plans,
  sections,
  exploredFiles,
  modifiedFiles,
  openTodos,
  openQuestions,
  violations,
  snapshot
}: TaskHandoffPanelProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [memo, setMemo] = useState("");
  const [copied, setCopied] = useState(false);
  const [prefs, setPrefs] = useState<HandoffPrefs>(() => loadPrefs(violations.length));

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

  const isDisabled =
    !prefs.include.summary &&
    !prefs.include.plans &&
    !prefs.include.process &&
    !prefs.include.files &&
    !prefs.include.modifiedFiles &&
    !prefs.include.todos &&
    !prefs.include.violations &&
    !prefs.include.questions &&
    memo.trim() === "";

  const handleCopy = useCallback((): void => {
    void copyToClipboard(preview).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [preview]);

  const updatePrefs = useCallback((next: HandoffPrefs): void => {
    setPrefs(next);
    savePrefs(next);
  }, []);

  const toggleInclude = useCallback((key: keyof HandoffPrefs["include"]): void => {
    updatePrefs({
      ...prefs,
      include: { ...prefs.include, [key]: !prefs.include[key] }
    });
  }, [updatePrefs, prefs]);

  const setFormat = useCallback((format: HandoffFormat): void => {
    updatePrefs({ ...prefs, format });
  }, [updatePrefs, prefs]);

  const setMode = useCallback((mode: HandoffMode): void => {
    updatePrefs({ ...prefs, mode });
  }, [updatePrefs, prefs]);

  const labelClass = "text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]";

  const pillBase = "rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[0.73rem] cursor-pointer select-none transition-colors";
  const pillChecked = "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]";

  const includeItems: { key: keyof HandoffPrefs["include"]; label: string }[] = [
    { key: "summary", label: "Summary" },
    { key: "plans", label: "Plan" },
    { key: "process", label: "Process" },
    { key: "files", label: "Files" },
    { key: "modifiedFiles", label: "Modified" },
    { key: "todos", label: "TODOs" },
    { key: "violations", label: "Violations" },
    { key: "questions", label: "Questions" }
  ];

  const formats: { value: HandoffFormat; label: string }[] = [
    { value: "plain", label: "Plain" },
    { value: "markdown", label: "Markdown" },
    { value: "xml", label: "XML" },
    { value: "system-prompt", label: "SP" }
  ];

  const modes: { value: HandoffMode; label: string }[] = [
    { value: "compact", label: "Compact" },
    { value: "standard", label: "Standard" },
    { value: "full", label: "Full" }
  ];

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)]">
      {/* Accordion header */}
      <button
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => setIsOpen((v) => !v)}
        type="button"
      >
        <span
          className="text-[0.75rem] text-[var(--text-3)] transition-transform duration-150"
          style={{ display: "inline-block", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          ▼
        </span>
        <span className="text-[0.82rem] font-semibold text-[var(--text-1)]">Copy for AI</span>
      </button>

      {/* Accordion body */}
      {isOpen && (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] px-3 py-3">

          {/* Include */}
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Include</span>
            <div className="flex flex-wrap gap-1.5">
              {includeItems.map(({ key, label }) => (
                <label
                  key={key}
                  className={cn(
                    pillBase,
                    "has-[:checked]:" + pillChecked,
                    prefs.include[key] ? pillChecked : ""
                  )}
                >
                  <input
                    checked={prefs.include[key]}
                    className="sr-only"
                    type="checkbox"
                    onChange={() => toggleInclude(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Handoff note */}
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Handoff note</span>
            <textarea
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[0.8rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)] resize-none"
              placeholder="Add a note for the next session…"
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>

          {/* Format selector */}
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Mode</span>
            <div className="flex rounded-[6px] border border-[var(--border)] overflow-hidden w-fit">
              {modes.map(({ value, label }) => (
                <button
                  key={value}
                  className={cn(
                    "px-2.5 py-1 text-[0.72rem] font-medium transition-colors",
                    prefs.mode === value
                      ? "bg-[var(--accent)] text-[#fff]"
                      : "text-[var(--text-2)] hover:text-[var(--text-1)]"
                  )}
                  type="button"
                  onClick={() => setMode(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Format selector */}
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Format</span>
            <div className="flex rounded-[6px] border border-[var(--border)] overflow-hidden w-fit">
              {formats.map(({ value, label }) => (
                <button
                  key={value}
                  className={cn(
                    "px-2.5 py-1 text-[0.72rem] font-medium transition-colors",
                    prefs.format === value
                      ? "bg-[var(--accent)] text-[#fff]"
                      : "text-[var(--text-2)] hover:text-[var(--text-1)]"
                  )}
                  type="button"
                  onClick={() => setFormat(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className={labelClass}>Preview</span>
              <span className="text-[0.7rem] text-[var(--text-3)]">{preview.length} chars</span>
            </div>
            <pre className="max-h-48 overflow-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] p-2 font-mono text-[0.72rem] text-[var(--text-1)] whitespace-pre">
              {preview
                ? preview
                : <span className="text-[var(--text-3)]">Nothing to preview — enable at least one section.</span>
              }
            </pre>
          </div>

          {/* Copy button */}
          <div className="flex justify-end">
            <button
              className={cn(
                "rounded-[7px] border px-3 py-1.5 text-[0.78rem] font-semibold transition-all",
                copied
                  ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
                  : isDisabled
                    ? "cursor-not-allowed border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-3)] opacity-50"
                    : "border-[var(--accent)] bg-[var(--accent)] text-[#fff] hover:opacity-90"
              )}
              disabled={isDisabled}
              type="button"
              onClick={handleCopy}
            >
              {copied ? "Copied ✓" : "Copy for AI"}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
