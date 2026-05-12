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

  // Cleanup scan now only emits archive suggestions. Older jobs may have
  // left rename/set_parent/reslug rows around — filter them out so the
  // panel stays focused on the archive review flow.
  const archiveSuggestions = useMemo(
    () =>
      (suggestions.data?.suggestions ?? []).filter((s) => s.kind === "archive"),
    [suggestions.data],
  );

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
      title="Archive suggestions"
      description="Claude scans your task list and flags duplicates, stale rows, and abandoned tasks worth archiving. Each suggestion needs your approval before it applies."
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
            flexWrap: "wrap",
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
              ? `Last scan ${formatRelativeShort(job.completedAt ?? job.createdAt, nowMs)} · ${archiveSuggestions.length} archive suggestion${archiveSuggestions.length === 1 ? "" : "s"} · ${job.tasksScanned} tasks`
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
              wordBreak: "break-word",
            }}
          >
            {failureMessage}
          </div>
        )}
        <SuggestionList
          suggestions={archiveSuggestions}
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
        No archive suggestions pending. Run a scan to look for stale or duplicate tasks.
      </p>
    );
  }
  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "grid",
        gap: 8,
        minWidth: 0,
      }}
    >
      {suggestions.map((s) => (
        <li key={s.id} style={{ minWidth: 0 }}>
          <SuggestionRow
            suggestion={s}
            taskTitle={taskTitleById.get(s.taskId) ?? s.taskId}
          />
        </li>
      ))}
    </ul>
  );
}

function SuggestionRow({
  suggestion,
  taskTitle,
}: {
  readonly suggestion: CleanupSuggestion;
  readonly taskTitle: string;
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
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
            flex: 1,
          }}
          title={taskTitle}
        >
          {taskTitle}
        </span>
      </div>
      <p
        style={{
          margin: "0 0 6px",
          fontSize: 12,
          color: "var(--ink-subtle)",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          lineHeight: 1.45,
        }}
      >
        {suggestion.rationale}
      </p>
      {error && (
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 11.5,
            color: "var(--err)",
            overflowWrap: "anywhere",
          }}
        >
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
          Archive
        </button>
      </div>
    </div>
  );
}

function readErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
