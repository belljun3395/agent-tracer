import { useState } from "react";
import { TaskCleanupModal } from "~web/widgets/task-list/TaskCleanupModal.js";
import { useTaskCleanupSuggestionsQuery } from "~web/entities/task-cleanup/api/queries.js";
import {
  useSetShowArchived,
  useShowArchived,
  useSidebarSearchQuery,
  useSetSidebarSearchQuery,
} from "~web/shared/store/index.js";
import { Tooltip } from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";

/** 사이드바 루트를 위한 검색창 + 보조 액션. */
export function TaskListHeader() {
  const value = useSidebarSearchQuery();
  const setValue = useSetSidebarSearchQuery();
  const showArchived = useShowArchived();
  const setShowArchived = useSetShowArchived();
  const cleanupSuggestions = useTaskCleanupSuggestionsQuery("pending");
  const pendingCount = (cleanupSuggestions.data?.suggestions ?? []).length;
  const [cleanupOpen, setCleanupOpen] = useState(false);

  return (
    <div className="mx-3 mb-2 flex items-center gap-2">
      <label className="flex-1 min-w-0 flex h-[30px] items-center gap-2 rounded-sm border border-hair bg-s1 px-2.5 text-ink-subtle focus-within:border-primary-focus focus-within:shadow-[0_0_0_2px_color-mix(in_srgb,var(--primary-focus)_30%,transparent)]">
        <SearchGlyph />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search tasks…"
          aria-label="Search tasks"
          className="flex-1 min-w-0 border-0 bg-transparent outline-0 font-sans font-normal text-[12.5px] text-ink tracking-[-0.05px]"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Clear search"
            className="text-ink-tertiary hover:text-ink text-sm leading-none"
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
          className="relative inline-flex h-[30px] w-[30px] items-center justify-center rounded-sm border border-hair bg-s1 hover:bg-s2 hover:text-ink text-ink-subtle"
        >
          <CleanupGlyph />
          {pendingCount > 0 && (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-[3px] rounded-[7px] bg-primary text-canvas font-mono text-[9.5px] leading-[14px] font-semibold text-center"
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
          className={cn(
            "inline-flex h-[30px] w-[30px] items-center justify-center rounded-sm border hover:bg-s2",
            showArchived ? "border-primary bg-primary/14 text-primary" : "border-hair bg-s1 text-ink-subtle",
          )}
        >
          <ArchiveGlyph />
        </button>
      </Tooltip>
      {cleanupOpen && (
        <TaskCleanupModal
          open={cleanupOpen}
          onClose={() => setCleanupOpen(false)}
        />
      )}
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
