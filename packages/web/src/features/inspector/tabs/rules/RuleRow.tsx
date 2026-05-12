import { useState, type MouseEvent } from "react";
import type { RuleRecord } from "~domain/rule.js";
import type { EventId, TaskId } from "~domain/monitoring.js";
import type { RuleEvidenceEvent, RuleMatchedBy } from "~io/api.js";
import {
  useDeleteRuleMutation,
  useDemoteRuleMutation,
  usePromoteRuleMutation,
  useReEvaluateRuleMutation,
} from "~state/server/mutations.js";
import { useRuleEvidenceQuery } from "~state/server/queries.js";
import { useSetSelectedEventId } from "~state/ui/index.js";
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
  const demoteMutation = useDemoteRuleMutation();
  const deleteMutation = useDeleteRuleMutation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const evidenceQ = useRuleEvidenceQuery(contextTaskId, rule.id, {
    enabled: expanded && contextTaskId !== null,
  });
  const canExpand = contextTaskId !== null && matchCount > 0;

  const isPending =
    reEvalMutation.isPending ||
    promoteMutation.isPending ||
    demoteMutation.isPending ||
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
  const handleDemote = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!contextTaskId) return;
    demoteMutation.mutate({ ruleId: rule.id, taskId: contextTaskId });
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
  const handleToggleExpand = () => {
    if (!canExpand) return;
    setExpanded((v) => !v);
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
      <button
        type="button"
        onClick={handleToggleExpand}
        disabled={!canExpand}
        aria-expanded={canExpand ? expanded : undefined}
        aria-label={
          canExpand
            ? expanded
              ? "Collapse rule evidence"
              : "Expand rule evidence"
            : undefined
        }
        className="flex items-center gap-2 flex-wrap w-full text-left"
        style={{
          background: "transparent",
          padding: 0,
          cursor: canExpand ? "pointer" : "default",
        }}
      >
        {canExpand && (
          <span
            aria-hidden
            style={{
              display: "inline-block",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--ink-tertiary)",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 120ms ease",
              width: 10,
            }}
          >
            ▶
          </span>
        )}
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
      </button>

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
        {rule.scope === "global" && contextTaskId !== null && (
          <Tooltip content="Demote to this task" side="top">
            <ActionButton
              onClick={handleDemote}
              disabled={isPending}
              label="Demote"
            >
              <DownIcon />
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

      {expanded && contextTaskId && (
        <EvidencePanel
          isLoading={evidenceQ.isLoading}
          isError={evidenceQ.isError}
          triggers={evidenceQ.data?.triggers ?? []}
          expects={evidenceQ.data?.expects ?? []}
        />
      )}
    </div>
  );
}

interface EvidencePanelProps {
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly triggers: readonly RuleEvidenceEvent[];
  readonly expects: readonly RuleEvidenceEvent[];
}

function EvidencePanel({ isLoading, isError, triggers, expects }: EvidencePanelProps) {
  const setSelectedEventId = useSetSelectedEventId();
  const files = expects.filter((e) => e.filePath);
  const actions = expects.filter((e) => !e.filePath);
  const unfulfilled = triggers.filter((t) => t.unfulfilled);

  const wrapStyle: React.CSSProperties = {
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px dashed var(--hair)",
  };

  if (isLoading) {
    return (
      <div style={{ ...wrapStyle, fontSize: 11, color: "var(--ink-tertiary)" }}>
        Loading evidence…
      </div>
    );
  }
  if (isError) {
    return (
      <div style={{ ...wrapStyle, fontSize: 11, color: "var(--err)" }}>
        Couldn't load evidence for this rule.
      </div>
    );
  }
  if (triggers.length === 0 && expects.length === 0) {
    return (
      <div style={{ ...wrapStyle, fontSize: 11, color: "var(--ink-tertiary)" }}>
        No matched events on this task yet.
      </div>
    );
  }

  return (
    <div
      style={{
        ...wrapStyle,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {unfulfilled.length > 0 && (
        <div
          style={{
            fontSize: 11,
            color: "var(--warn, #b58900)",
            padding: "4px 8px",
            border: "1px dashed var(--warn, #b58900)",
            borderRadius: "var(--radius-xs)",
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <span>⚠</span>
          <span>
            Trigger fired but no expected follow-up landed on this task.
          </span>
        </div>
      )}
      {triggers.length > 0 && (
        <EvidenceSection
          label="Triggers"
          count={triggers.length}
          events={triggers}
          onJump={setSelectedEventId}
        />
      )}
      {files.length > 0 && (
        <EvidenceSection
          label="Files"
          count={files.length}
          events={files}
          onJump={setSelectedEventId}
        />
      )}
      {actions.length > 0 && (
        <EvidenceSection
          label="Actions"
          count={actions.length}
          events={actions}
          onJump={setSelectedEventId}
        />
      )}
    </div>
  );
}

interface EvidenceSectionProps {
  readonly label: string;
  readonly count: number;
  readonly events: readonly RuleEvidenceEvent[];
  readonly onJump: (eventId: EventId) => void;
}

function EvidenceSection({ label, count, events, onJump }: EvidenceSectionProps) {
  return (
    <div className="flex flex-col gap-1">
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--ink-tertiary)",
        }}
      >
        {label} ({count})
      </div>
      {events.map((ev) => (
        <EvidenceRow key={`${label}-${ev.eventId}`} event={ev} onJump={onJump} />
      ))}
    </div>
  );
}

function EvidenceRow({
  event,
  onJump,
}: {
  event: RuleEvidenceEvent;
  onJump: (eventId: EventId) => void;
}) {
  const icon = pickIcon(event);
  const primary = event.filePath ?? event.command ?? event.title;
  const time = formatTime(event.createdAt);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onJump(event.eventId as EventId);
      }}
      className="text-left"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 6px",
        background: "transparent",
        border: "1px solid transparent",
        borderRadius: "var(--radius-xs)",
        fontSize: 11.5,
        color: "var(--ink)",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--s2)";
        e.currentTarget.style.borderColor = "var(--hair)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderColor = "transparent";
      }}
    >
      <span style={{ width: 14, color: "var(--ink-tertiary)" }}>{icon}</span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontFamily:
            event.filePath || event.command ? "var(--font-mono)" : undefined,
          fontSize: event.filePath || event.command ? 11 : 11.5,
        }}
      >
        {primary}
      </span>
      {event.toolName && (event.filePath || event.command) && (
        <span
          style={{
            fontSize: 10,
            color: "var(--ink-tertiary)",
            fontFamily: "var(--font-mono)",
            whiteSpace: "nowrap",
          }}
        >
          {event.toolName}
        </span>
      )}
      <span
        style={{
          fontSize: 9.5,
          color: "var(--ink-tertiary)",
          fontFamily: "var(--font-mono)",
          whiteSpace: "nowrap",
        }}
      >
        {time}
      </span>
      {event.matchedBy.length > 0 && (
        <MatchedByChips labels={event.matchedBy} matchKind={event.matchKind} />
      )}
      <span
        style={{
          fontSize: 9,
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          padding: "1px 5px",
          borderRadius: "var(--radius-xs)",
          color: event.unfulfilled
            ? "var(--warn, #b58900)"
            : event.matchKind === "trigger"
              ? "var(--primary-hover)"
              : "var(--ink-tertiary)",
          background: event.unfulfilled
            ? "color-mix(in srgb, var(--warn, #b58900) 12%, transparent)"
            : event.matchKind === "trigger"
              ? "color-mix(in srgb, var(--primary) 18%, transparent)"
              : "var(--s2)",
        }}
      >
        {event.matchKind === "trigger"
          ? event.unfulfilled
            ? "trigger ⚠"
            : "trigger"
          : "expect"}
      </span>
    </button>
  );
}

function MatchedByChips({
  labels,
  matchKind,
}: {
  labels: readonly RuleMatchedBy[];
  matchKind: "trigger" | "expect-fulfilled";
}) {
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {labels.map((l) => (
        <span
          key={l}
          title={
            matchKind === "trigger"
              ? "Matched a configured trigger phrase"
              : `Matched the rule's ${l} condition`
          }
          style={{
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            color: "var(--ink-tertiary)",
            padding: "1px 5px",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--hair)",
            background: "var(--canvas)",
          }}
        >
          {labelShort(l)}
        </span>
      ))}
    </span>
  );
}

function labelShort(l: RuleMatchedBy): string {
  switch (l) {
    case "action":
      return "action";
    case "commandMatch":
      return "cmd";
    case "pattern":
      return "regex";
    case "trigger-phrase":
      return "phrase";
  }
}

function pickIcon(ev: RuleEvidenceEvent): string {
  if (ev.filePath) {
    if (
      ev.kind === "file.changed" ||
      ev.toolName === "Edit" ||
      ev.toolName === "Write"
    ) {
      return "✏️";
    }
    return "📖";
  }
  if (ev.command || ev.toolName === "Bash") return "▶";
  if (ev.kind === "user.message") return "💬";
  if (ev.kind === "assistant.response") return "🗨️";
  if (ev.toolName === "WebFetch" || ev.toolName === "WebSearch") return "🌐";
  return "•";
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
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

function DownIcon() {
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
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );
}
