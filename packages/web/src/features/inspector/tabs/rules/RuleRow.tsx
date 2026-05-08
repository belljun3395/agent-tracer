import { useState, type MouseEvent } from "react";
import type { RuleRecord } from "~domain/rule.js";
import type { TaskId } from "~domain/monitoring.js";
import {
  useDeleteRuleMutation,
  usePromoteRuleMutation,
  useReEvaluateRuleMutation,
} from "~state/server/mutations.js";
import { Tooltip } from "~ui/index.js";
import { cn } from "~lib/cn.js";
import { RuleSeverityChip } from "./RuleSeverityChip.js";

interface RuleRowProps {
  readonly rule: RuleRecord;
  readonly matchCount: number;
  /** Current task context — used for re-evaluate scoping. */
  readonly contextTaskId: TaskId | null;
  /** Open the rule editor modal pre-filled with this rule. */
  readonly onEdit: (rule: RuleRecord) => void;
}

/**
 * One rule listed in the Rules tab. Severity chip + name + scope/source
 * meta + match count + a row of single-click actions:
 *
 *   • re-evaluate (run classifier against current task)
 *   • promote     (only when scope === 'task' — moves rule to global)
 *   • delete      (two-click confirm pattern, mirrors TaskRow)
 *
 * Form-based create/edit is deferred to a later round; runtime config
 * is the canonical source for net-new rules anyway.
 */
export function RuleRow({ rule, matchCount, contextTaskId, onEdit }: RuleRowProps) {
  const reEvalMutation = useReEvaluateRuleMutation();
  const promoteMutation = usePromoteRuleMutation();
  const deleteMutation = useDeleteRuleMutation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isPending =
    reEvalMutation.isPending ||
    promoteMutation.isPending ||
    deleteMutation.isPending;

  const handleReEval = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    reEvalMutation.mutate({
      ruleId: rule.id,
      ...(contextTaskId ? { taskId: contextTaskId } : {}),
    });
  };
  const handlePromote = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    promoteMutation.mutate(rule.id);
  };
  const handleDelete = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      window.setTimeout(() => setConfirmingDelete(false), 3500);
      return;
    }
    deleteMutation.mutate(rule.id);
  };
  const handleEdit = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onEdit(rule);
  };

  return (
    <div
      className={cn(
        "group px-3 py-2.5 rounded-[var(--radius-sm)]",
        isPending && "opacity-50",
      )}
      style={{
        background: "var(--s1)",
        border: "1px solid var(--hair)",
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <RuleSeverityChip severity={rule.severity} />
        <span
          className="flex-1 min-w-0 truncate"
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.05px",
          }}
        >
          {rule.name}
        </span>
        <MatchBadge count={matchCount} />
      </div>

      <div
        className="flex items-center gap-2 flex-wrap mt-1.5"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          color: "var(--ink-tertiary)",
        }}
      >
        <span>scope · {rule.scope}</span>
        <span style={{ color: "var(--hair-strong)" }}>·</span>
        <span>source · {rule.source}</span>
        {rule.expect.tool && (
          <>
            <span style={{ color: "var(--hair-strong)" }}>·</span>
            <span>tool · {rule.expect.tool}</span>
          </>
        )}
      </div>

      {rule.rationale && (
        <p
          className="mt-2"
          style={{
            margin: 0,
            fontSize: 11.5,
            color: "var(--ink-subtle)",
            lineHeight: 1.5,
          }}
        >
          {rule.rationale}
        </p>
      )}

      <div className="flex items-center gap-1 mt-2">
        <Tooltip
          content={
            contextTaskId ? "Re-evaluate against current task" : "Re-evaluate"
          }
          side="top"
        >
          <ActionButton
            onClick={handleReEval}
            disabled={isPending}
            label="Re-evaluate"
          >
            <RefreshIcon />
          </ActionButton>
        </Tooltip>
        {rule.scope === "task" && (
          <Tooltip content="Promote to global rule" side="top">
            <ActionButton
              onClick={handlePromote}
              disabled={isPending}
              label="Promote"
            >
              <UpIcon />
            </ActionButton>
          </Tooltip>
        )}
        <Tooltip content="Edit rule" side="top">
          <ActionButton onClick={handleEdit} disabled={isPending} label="Edit">
            <PencilIcon />
          </ActionButton>
        </Tooltip>
        <span className="flex-1" />
        <Tooltip
          content={
            confirmingDelete
              ? "Click again to confirm"
              : deleteMutation.isError
                ? "Delete failed — try again"
                : "Delete rule"
          }
          side="top"
        >
          <ActionButton
            onClick={handleDelete}
            disabled={isPending}
            label={confirmingDelete ? "Confirm delete" : "Delete"}
            tone={confirmingDelete || deleteMutation.isError ? "danger" : "neutral"}
            armed={confirmingDelete}
          >
            <TrashIcon />
          </ActionButton>
        </Tooltip>
      </div>
    </div>
  );
}

interface ActionButtonProps {
  readonly onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  readonly disabled?: boolean;
  readonly label: string;
  readonly tone?: "neutral" | "danger";
  readonly armed?: boolean;
  readonly children: React.ReactNode;
}

function ActionButton({
  onClick,
  disabled,
  label,
  tone = "neutral",
  armed,
  children,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center h-6 w-6 rounded-[var(--radius-xs)]",
        "transition-colors disabled:opacity-40 disabled:pointer-events-none",
      )}
      style={{
        color:
          tone === "danger" ? "var(--err)" : "var(--ink-tertiary)",
        background: armed
          ? "color-mix(in srgb, var(--err) 14%, transparent)"
          : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function MatchBadge({ count }: { count: number }) {
  const fired = count > 0;
  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-xs)] px-1.5"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: fired ? "var(--primary-hover)" : "var(--ink-tertiary)",
        background: fired
          ? "color-mix(in srgb, var(--primary) 18%, transparent)"
          : "transparent",
        lineHeight: "16px",
      }}
    >
      {fired ? `${count} match${count === 1 ? "" : "es"}` : "—"}
    </span>
  );
}

function TrashIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function UpIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}
