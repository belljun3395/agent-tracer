import { useState } from "react";
import { TaskCleanupModal } from "~features/task-cleanup/TaskCleanupModal.js";
import { useTaskCleanupSuggestionsQuery } from "~state/server/queries.js";
import {
  useSetShowArchived,
  useShowArchived,
  useSidebarSearchQuery,
  useSetSidebarSearchQuery,
} from "~state/ui/index.js";
import { Tooltip } from "~ui/index.js";

/**
 * Search input + secondary actions for the sidebar root.
 *
 * The filter pill row underneath is intentionally kept narrow (just
 * All / Live / Attn / Done) — global actions live here on the right
 * so they don't crowd the filter row when the sidebar gets narrow.
 */
export function TaskListHeader() {
  const value = useSidebarSearchQuery();
  const setValue = useSetSidebarSearchQuery();
  const showArchived = useShowArchived();
  const setShowArchived = useSetShowArchived();
  const cleanupSuggestions = useTaskCleanupSuggestionsQuery("pending");
  const pendingCount = (cleanupSuggestions.data?.suggestions ?? []).filter(
    (s) => s.kind === "archive",
  ).length;
  const [cleanupOpen, setCleanupOpen] = useState(false);

  return (
    <div className="mx-3 mb-2 flex items-center gap-2">
      <label
        className="flex-1 min-w-0 flex h-[30px] items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--hair)] bg-[var(--s1)] px-2.5 focus-within:border-[var(--primary-focus)] focus-within:shadow-[0_0_0_2px_color-mix(in_srgb,var(--primary-focus)_30%,transparent)]"
        style={{ color: "var(--ink-subtle)" }}
      >
        <SearchGlyph />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search tasks…"
          aria-label="Search tasks"
          className="flex-1 min-w-0 border-0 bg-transparent outline-0"
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 400,
            fontSize: 12.5,
            color: "var(--ink)",
            letterSpacing: "-0.05px",
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Clear search"
            className="text-[var(--ink-tertiary)] hover:text-[var(--ink)]"
            style={{ fontSize: 14, lineHeight: 1 }}
          >
            ×
          </button>
        )}
      </label>
      <Tooltip
        content={
          pendingCount > 0
            ? `${pendingCount} archive suggestion${pendingCount === 1 ? "" : "s"} pending — review`
            : "Scan tasks for cleanup suggestions"
        }
        side="bottom"
      >
        <button
          type="button"
          onClick={() => setCleanupOpen(true)}
          aria-label="Open task cleanup"
          className="relative inline-flex h-[30px] w-[30px] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hair)] bg-[var(--s1)] hover:bg-[var(--s2)] hover:text-[var(--ink)]"
          style={{ color: "var(--ink-subtle)" }}
        >
          <CleanupGlyph />
          {pendingCount > 0 && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                minWidth: 14,
                height: 14,
                padding: "0 3px",
                borderRadius: 7,
                background: "var(--primary)",
                color: "var(--canvas)",
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                lineHeight: "14px",
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </button>
      </Tooltip>
      <Tooltip
        content={showArchived ? "Back to active tasks" : "Show archived tasks"}
        side="bottom"
      >
        <button
          type="button"
          onClick={() => setShowArchived(!showArchived)}
          aria-pressed={showArchived}
          aria-label={showArchived ? "Back to active tasks" : "Show archived tasks"}
          className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[var(--radius-sm)] border hover:bg-[var(--s2)]"
          style={{
            borderColor: showArchived ? "var(--primary)" : "var(--hair)",
            background: showArchived
              ? "color-mix(in srgb, var(--primary) 14%, transparent)"
              : "var(--s1)",
            color: showArchived ? "var(--primary)" : "var(--ink-subtle)",
          }}
        >
          <ArchiveGlyph />
        </button>
      </Tooltip>
      <TaskCleanupModal
        open={cleanupOpen}
        onClose={() => setCleanupOpen(false)}
      />
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CleanupGlyph() {
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
      aria-hidden
    >
      <path d="M5 4l2 4 4 2-4 2-2 4-2-4-4-2 4-2zM17 13l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
    </svg>
  );
}

function ArchiveGlyph() {
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
      aria-hidden
    >
      <path d="M3 7h18v3H3zM5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9M10 14h4" />
    </svg>
  );
}
