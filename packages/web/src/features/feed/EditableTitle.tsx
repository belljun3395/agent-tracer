import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { MonitoringTask } from "~domain/monitoring.js";
import { useUpdateTaskMutation } from "~state/server/mutations.js";
import { Tooltip } from "~ui/index.js";

interface EditableTitleProps {
  readonly task: MonitoringTask;
}

/**
 * Inline-editable H1 for the task title.
 *
 * UX:
 *   - Click the title (or the small edit icon) → swap to <input>
 *   - Enter to save, Escape to cancel
 *   - Click outside to save
 *   - While saving, input stays mounted with reduced opacity
 *   - On error: revert to original (mutation handles cache rollback)
 */
export function EditableTitle({ task }: EditableTitleProps) {
  const mutation = useUpdateTaskMutation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const current = task.displayTitle ?? task.title;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    setDraft(current);
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === current) {
      setEditing(false);
      return;
    }
    mutation.mutate(
      { taskId: task.id, body: { title: trimmed } },
      { onSettled: () => setEditing(false) },
    );
  };

  const cancel = () => {
    setEditing(false);
    setDraft(current);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: "-0.4px",
    lineHeight: 1.25,
    color: "var(--ink)",
    minWidth: 0,
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        disabled={mutation.isPending}
        className="flex-1 min-w-0"
        style={{
          ...titleStyle,
          background: "var(--s1)",
          border: "1px solid var(--primary)",
          borderRadius: "var(--radius-sm)",
          padding: "2px 8px",
          outline: "none",
          opacity: mutation.isPending ? 0.6 : 1,
        }}
        aria-label="Task title"
      />
    );
  }

  return (
    <Tooltip content="Click to rename" side="bottom">
      <h1
        className="flex-1 min-w-0 group cursor-pointer rounded-[var(--radius-sm)] hover:bg-[var(--s1)]"
        style={{
          ...titleStyle,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "2px 6px",
          margin: "-2px -6px",
          transition: "background 120ms",
        }}
        onClick={startEditing}
        // Keyboard parity — Tab to the heading, Enter/Space to edit.
        tabIndex={0}
        role="button"
        aria-label={`Edit task title: ${current}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEditing();
          }
        }}
      >
        <span
          className="group-hover:underline"
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textUnderlineOffset: 3,
            textDecorationColor: "var(--hair-strong)",
          }}
        >
          {current}
        </span>
        <span
          aria-hidden
          style={{
            opacity: 0.55,
            color: "var(--ink-tertiary)",
            transition: "opacity 150ms",
          }}
          className="group-hover:opacity-100"
        >
          <PencilIcon />
        </span>
      </h1>
    </Tooltip>
  );
}

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
    </svg>
  );
}
