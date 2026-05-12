import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import type { MonitoringTask } from "~domain/monitoring.js";
import type { TitleSuggestion } from "~io/api.js";
import {
  useSuggestTaskTitleMutation,
  useUpdateTaskMutation,
} from "~state/server/mutations.js";
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
  const suggestMutation = useSuggestTaskTitleMutation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<readonly TitleSuggestion[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sparkleRef = useRef<HTMLButtonElement>(null);
  const current = task.displayTitle ?? task.title;

  const handleSuggest = () => {
    setSuggestError(null);
    setShowSuggestions(true);
    suggestMutation.mutate(task.id, {
      onSuccess: (data) => setSuggestions(data.suggestions),
      onError: (err: unknown) =>
        setSuggestError(err instanceof Error ? err.message : String(err)),
    });
  };

  const applySuggestion = (title: string) => {
    mutation.mutate(
      { taskId: task.id, body: { title } },
      {
        onSettled: () => {
          setShowSuggestions(false);
          setSuggestions([]);
        },
      },
    );
  };

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
    <div className="flex-1 min-w-0" style={{ position: "relative" }}>
      <Tooltip content="Click to rename" side="bottom">
        <h1
          className="group cursor-pointer rounded-[var(--radius-sm)] hover:bg-[var(--s1)]"
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
          <Tooltip content="Suggest a better title with Claude" side="top">
            <button
              ref={sparkleRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSuggest();
              }}
              aria-label="Suggest title"
              disabled={suggestMutation.isPending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 22,
                width: 22,
                marginLeft: 2,
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--hair)",
                background: "transparent",
                color: "var(--ink-tertiary)",
                cursor: suggestMutation.isPending ? "wait" : "pointer",
                opacity: 0.55,
                transition: "opacity 150ms",
              }}
              className="group-hover:opacity-100 hover:!opacity-100"
            >
              <SparkleIcon spinning={suggestMutation.isPending} />
            </button>
          </Tooltip>
        </h1>
      </Tooltip>
      {showSuggestions && (
        <SuggestionsPopover
          anchorRef={sparkleRef}
          loading={suggestMutation.isPending}
          error={suggestError}
          suggestions={suggestions}
          currentTitle={current}
          onApply={applySuggestion}
          onClose={() => {
            setShowSuggestions(false);
            setSuggestions([]);
            setSuggestError(null);
          }}
        />
      )}
    </div>
  );
}

function SuggestionsPopover({
  anchorRef,
  loading,
  error,
  suggestions,
  currentTitle,
  onApply,
  onClose,
}: {
  readonly anchorRef: { readonly current: HTMLElement | null };
  readonly loading: boolean;
  readonly error: string | null;
  readonly suggestions: readonly TitleSuggestion[];
  readonly currentTitle: string;
  readonly onApply: (title: string) => void;
  readonly onClose: () => void;
}) {
  // Render into document.body so the sticky header / scroll viewport can't
  // clip us, and position via fixed coords measured from the anchor button.
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const reposition = () => {
      const node = anchorRef.current;
      if (!node) {
        setCoords(null);
        return;
      }
      const rect = node.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8,
        left: rect.left,
      });
    };
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [anchorRef]);

  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!coords) return null;

  return createPortal(
    <div
      role="dialog"
      aria-label="Title suggestions"
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        zIndex: 1000,
        maxWidth: 520,
        minWidth: 320,
        background: "var(--s1)",
        border: "1px solid var(--hair)",
        borderRadius: "var(--radius-sm)",
        boxShadow: "0 12px 32px -8px rgba(0,0,0,0.45)",
        padding: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "var(--ink-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Suggested titles
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--ink-tertiary)",
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      {loading && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-subtle)" }}>
          Claude is reading the task summary…
        </p>
      )}
      {error && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--err)",
            overflowWrap: "anywhere",
          }}
        >
          {error}
        </p>
      )}
      {!loading && !error && suggestions.length === 0 && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-subtle)" }}>
          The current title looks fine — Claude has no rename to suggest.
        </p>
      )}
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gap: 6,
        }}
      >
        {suggestions.map((s, i) => (
          <li key={`${i}-${s.title}`} style={{ minWidth: 0 }}>
            <button
              type="button"
              onClick={() => onApply(s.title)}
              disabled={s.title === currentTitle}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "6px 8px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--hair)",
                background: "var(--s2)",
                color: "var(--ink)",
                cursor: s.title === currentTitle ? "default" : "pointer",
                fontSize: 12.5,
                fontWeight: 500,
                lineHeight: 1.35,
                overflowWrap: "anywhere",
              }}
            >
              <div>{s.title}</div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  color: "var(--ink-tertiary)",
                  marginTop: 2,
                  lineHeight: 1.4,
                }}
              >
                {s.rationale}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
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

function SparkleIcon({ spinning }: { readonly spinning: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={
        spinning
          ? { animation: "spin 0.9s linear infinite" }
          : undefined
      }
    >
      <path d="M5 4l2 4 4 2-4 2-2 4-2-4-4-2 4-2zM17 13l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
    </svg>
  );
}
