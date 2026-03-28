import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  loadHandoffDraft,
  saveHandoffDraft,
  type HandoffFormat,
  type HandoffPrefs
} from "../lib/ui/handoffStorage.js";

// ── Props ─────────────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export function TaskHandoffPanel({
  taskId,
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
  const initialDraft = useMemo(
    () => loadHandoffDraft(taskId, violations.length),
    [taskId, violations.length]
  );
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
  const canCopyLast = Boolean(lastCopiedText && lastCopiedText !== preview);

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
              <div className="flex items-center gap-2 text-[0.7rem] text-[var(--text-3)]">
                {lastCopiedAt ? <span>Last copy saved locally</span> : null}
                <span>{preview.length} chars</span>
              </div>
            </div>
            <pre className="max-h-48 overflow-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] p-2 font-mono text-[0.72rem] text-[var(--text-1)] whitespace-pre">
              {preview
                ? preview
                : <span className="text-[var(--text-3)]">Nothing to preview — enable at least one section.</span>
              }
            </pre>
          </div>

          {/* Copy button */}
          <div className="flex justify-end gap-2">
            {canCopyLast && lastCopiedText ? (
              <button
                className="rounded-[7px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[0.78rem] font-semibold text-[var(--text-2)] transition-colors hover:text-[var(--text-1)]"
                type="button"
                onClick={() => handleCopy(lastCopiedText)}
              >
                Copy last
              </button>
            ) : null}
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
              onClick={() => handleCopy(preview)}
            >
              {copied ? "Copied ✓" : "Copy for AI"}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
