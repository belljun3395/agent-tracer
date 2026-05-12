import { useMemo, useState } from "react";
import type { CleanupSuggestion } from "~io/api.js";
import {
  useAcceptCleanupSuggestionMutation,
  useDismissCleanupSuggestionMutation,
  useEnqueueTaskCleanupScanMutation,
} from "~state/server/mutations.js";
import {
  useLatestTaskCleanupJobQuery,
  useTaskCleanupSuggestionsQuery,
  useTasksQuery,
} from "~state/server/queries.js";
import { Modal } from "~ui/index.js";
import { formatRelativeShort } from "~lib/time.js";
import { useNowMs } from "~state/ui/useNowMs.js";

interface TaskCleanupModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function TaskCleanupModal({ open, onClose }: TaskCleanupModalProps) {
  const latestJob = useLatestTaskCleanupJobQuery({ enabled: open });
  const suggestions = useTaskCleanupSuggestionsQuery("pending");
  const tasksQuery = useTasksQuery("all");
  const enqueueMutation = useEnqueueTaskCleanupScanMutation();
  const nowMs = useNowMs(5_000);

  const taskTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasksQuery.data?.tasks ?? []) {
      map.set(t.id, t.displayTitle ?? t.title);
    }
    return map;
  }, [tasksQuery.data]);

  const job = latestJob.data?.job ?? null;
  const isScanning = job?.status === "pending" || job?.status === "processing";
  const failureMessage =
    enqueueMutation.isError
      ? readErrorMessage(enqueueMutation.error)
      : job?.status === "failed"
        ? job.error || "Last scan failed"
        : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cleanup suggestions"
      description="Claude reviews your task list and proposes archive / rename / hierarchy fixes. Each suggestion needs your approval before it applies."
      maxWidth={620}
    >
      <div style={{ padding: "12px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            disabled={isScanning || enqueueMutation.isPending}
            onClick={() => enqueueMutation.mutate()}
            style={{
              padding: "6px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--hair)",
              background:
                isScanning || enqueueMutation.isPending
                  ? "var(--s2)"
                  : "var(--primary)",
              color:
                isScanning || enqueueMutation.isPending
                  ? "var(--ink-subtle)"
                  : "var(--canvas)",
              fontSize: 12.5,
              fontWeight: 500,
              cursor:
                isScanning || enqueueMutation.isPending
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {isScanning ? "Scanning…" : "Scan tasks"}
          </button>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--ink-tertiary)",
            }}
          >
            {job
              ? `Last scan ${formatRelativeShort(job.completedAt ?? job.createdAt, nowMs)} · ${job.suggestionsCreated} suggestions · ${job.tasksScanned} tasks`
              : "No scan yet"}
          </span>
        </div>
        {failureMessage && (
          <div
            style={{
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--err)",
              color: "var(--err)",
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            {failureMessage}
          </div>
        )}
        <SuggestionList
          suggestions={suggestions.data?.suggestions ?? []}
          isLoading={suggestions.isLoading}
          taskTitleById={taskTitleById}
        />
      </div>
    </Modal>
  );
}

function SuggestionList({
  suggestions,
  isLoading,
  taskTitleById,
}: {
  readonly suggestions: readonly CleanupSuggestion[];
  readonly isLoading: boolean;
  readonly taskTitleById: ReadonlyMap<string, string>;
}) {
  if (isLoading) {
    return (
      <p style={{ fontSize: 12, color: "var(--ink-subtle)" }}>Loading suggestions…</p>
    );
  }
  if (suggestions.length === 0) {
    return (
      <p style={{ fontSize: 12, color: "var(--ink-subtle)" }}>
        No pending suggestions. Run a scan to look for cleanup opportunities.
      </p>
    );
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {suggestions.map((s) => {
        const parentTitle =
          s.kind === "set_parent"
            ? taskTitleById.get(readParentId(s.proposedValue) ?? "")
            : undefined;
        return (
          <li key={s.id}>
            <SuggestionRow
              suggestion={s}
              taskTitle={taskTitleById.get(s.taskId) ?? s.taskId}
              {...(parentTitle ? { parentTaskTitle: parentTitle } : {})}
            />
          </li>
        );
      })}
    </ul>
  );
}

function SuggestionRow({
  suggestion,
  taskTitle,
  parentTaskTitle,
}: {
  readonly suggestion: CleanupSuggestion;
  readonly taskTitle: string;
  readonly parentTaskTitle?: string;
}) {
  const accept = useAcceptCleanupSuggestionMutation();
  const dismiss = useDismissCleanupSuggestionMutation();
  const [error, setError] = useState<string | null>(null);
  const isBusy = accept.isPending || dismiss.isPending;

  const handleAccept = () => {
    setError(null);
    accept.mutate(suggestion.id, {
      onError: (err: unknown) => setError(readErrorMessage(err)),
    });
  };
  const handleDismiss = () => {
    setError(null);
    dismiss.mutate(suggestion.id);
  };

  return (
    <div
      style={{
        border: "1px solid var(--hair)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 12px",
        background: "var(--s2)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <KindBadge kind={suggestion.kind} />
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={taskTitle}
        >
          {taskTitle}
        </span>
      </div>
      <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--ink-subtle)" }}>
        {suggestion.rationale}
      </p>
      <SuggestionDiff
        suggestion={suggestion}
        {...(parentTaskTitle ? { parentTaskTitle } : {})}
      />
      {error && (
        <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--err)" }}>
          {error}
        </p>
      )}
      <div
        style={{
          marginTop: 8,
          display: "flex",
          gap: 6,
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isBusy}
          style={{
            padding: "4px 10px",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--hair)",
            background: "transparent",
            color: "var(--ink-subtle)",
            fontSize: 11.5,
            cursor: isBusy ? "not-allowed" : "pointer",
          }}
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={handleAccept}
          disabled={isBusy}
          style={{
            padding: "4px 10px",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--primary)",
            background: "var(--primary)",
            color: "var(--canvas)",
            fontSize: 11.5,
            fontWeight: 500,
            cursor: isBusy ? "not-allowed" : "pointer",
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}

function KindBadge({ kind }: { readonly kind: CleanupSuggestion["kind"] }) {
  const label =
    kind === "archive"
      ? "Archive"
      : kind === "rename_title"
        ? "Rename"
        : kind === "set_parent"
          ? "Set parent"
          : "Reslug";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 6px",
        borderRadius: "var(--radius-xs)",
        border: "1px solid var(--hair)",
        fontSize: 10.5,
        color: "var(--ink-subtle)",
        textTransform: "uppercase",
        letterSpacing: "0.02em",
      }}
    >
      {label}
    </span>
  );
}

function SuggestionDiff({
  suggestion,
  parentTaskTitle,
}: {
  readonly suggestion: CleanupSuggestion;
  readonly parentTaskTitle?: string;
}) {
  if (suggestion.kind === "archive") return null;
  if (suggestion.kind === "rename_title") {
    return (
      <DiffLine
        from={readField(suggestion.currentValue, "title")}
        to={readField(suggestion.proposedValue, "title")}
      />
    );
  }
  if (suggestion.kind === "reslug") {
    return (
      <DiffLine
        from={readField(suggestion.currentValue, "slug")}
        to={readField(suggestion.proposedValue, "slug")}
      />
    );
  }
  if (suggestion.kind === "set_parent") {
    return (
      <DiffLine
        from={readField(suggestion.currentValue, "parentTaskId") ?? "(none)"}
        to={
          parentTaskTitle ??
          readField(suggestion.proposedValue, "parentTaskId") ??
          "(unknown)"
        }
      />
    );
  }
  return null;
}

function DiffLine({
  from,
  to,
}: {
  readonly from?: string | null;
  readonly to?: string | null;
}) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11.5,
        color: "var(--ink-tertiary)",
        background: "var(--s1)",
        border: "1px solid var(--hair)",
        borderRadius: "var(--radius-xs)",
        padding: "4px 8px",
      }}
    >
      <div style={{ color: "var(--err)" }}>− {from ?? "(empty)"}</div>
      <div style={{ color: "var(--ok)" }}>+ {to ?? "(empty)"}</div>
    </div>
  );
}

function readField(value: unknown, field: string): string | null {
  if (!value || typeof value !== "object") return null;
  const v = (value as Record<string, unknown>)[field];
  return typeof v === "string" ? v : null;
}

function readParentId(value: unknown): string | null {
  return readField(value, "parentTaskId");
}

function readErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
