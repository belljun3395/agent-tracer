import { useState } from "react";
import {
  useSetShowArchived,
  useShowArchived,
  useSidebarFilter,
  useSetSidebarFilter,
  type SidebarFilter,
} from "~state/ui/index.js";
import { cn } from "~lib/cn.js";
import { TaskCleanupModal } from "~features/task-cleanup/TaskCleanupModal.js";
import { useTaskCleanupSuggestionsQuery } from "~state/server/queries.js";

interface TaskListFiltersProps {
  readonly counts: Readonly<Record<SidebarFilter, number>>;
  /**
   * When every visible task shares the same `runtimeSource`, the panel
   * passes it down so we can show a single subtle caption instead of
   * the per-row tag. Omitted otherwise.
   */
  readonly uniformRuntime?: string;
}

/**
 * Four-pill row pinned under the search input. Each pill shows its label
 * + count; the active pill picks up `--s2` background. Counts come from
 * the `useTaskList` view-model so they're computed once per render tick.
 *
 * When every task in the list shares a runtime, a small "all `<runtime>`"
 * caption is appended on the right and the per-row badge is suppressed
 * (the panel passes `hideRuntimeBadge` down to each row).
 */
export function TaskListFilters({
  counts,
  uniformRuntime,
}: TaskListFiltersProps) {
  const active = useSidebarFilter();
  const setFilter = useSetSidebarFilter();
  const showArchived = useShowArchived();
  const setShowArchived = useSetShowArchived();
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const cleanupSuggestions = useTaskCleanupSuggestionsQuery("pending");
  const pendingCount = (cleanupSuggestions.data?.suggestions ?? []).filter(
    (s) => s.kind === "archive",
  ).length;

  if (showArchived) {
    return (
      <>
        <div
          className="flex items-center justify-between gap-2 px-2.5 pb-1.5 border-b border-[var(--hair)]"
          style={{ fontSize: 11.5 }}
        >
          <span
            className="inline-flex items-center gap-1.5"
            style={{ color: "var(--ink-subtle)" }}
          >
            <ArchiveGlyph />
            <span>
              Archived <span style={{ color: "var(--ink-tertiary)" }}>({counts.all})</span>
            </span>
          </span>
          <button
            type="button"
            onClick={() => setShowArchived(false)}
            className="rounded-[var(--radius-sm)] px-[9px] py-[5px] text-[11.5px] font-medium hover:bg-[var(--s1)]"
            style={{ color: "var(--ink-subtle)" }}
          >
            Back to active
          </button>
        </div>
        <TaskCleanupModal open={cleanupOpen} onClose={() => setCleanupOpen(false)} />
      </>
    );
  }

  return (
    <div className="flex items-center gap-px px-2.5 pb-1.5 border-b border-[var(--hair)]">
      <FilterPill
        label="All"
        count={counts.all}
        active={active === "all"}
        onClick={() => setFilter("all")}
      />
      <FilterPill
        label="Live"
        count={counts.live}
        active={active === "live"}
        onClick={() => setFilter("live")}
        dot="primary"
      />
      <FilterPill
        label="Attn"
        count={counts.attn}
        active={active === "attn"}
        onClick={() => setFilter("attn")}
        dot="err"
        title="Needs you — tasks awaiting your input or stopped on an error"
      />
      <FilterPill
        label="Done"
        count={counts.done}
        active={active === "done"}
        onClick={() => setFilter("done")}
        dot="ok"
      />
      {uniformRuntime && (
        <span
          className="ml-auto pl-2 pr-0.5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--ink-tertiary)",
            letterSpacing: "0.02em",
          }}
          title={`Every task in this list is sourced from ${uniformRuntime}`}
        >
          all {uniformRuntime}
        </span>
      )}
      <button
        type="button"
        onClick={() => setCleanupOpen(true)}
        title={
          pendingCount > 0
            ? `${pendingCount} cleanup suggestion${pendingCount === 1 ? "" : "s"} pending`
            : "Open task cleanup"
        }
        className={cn(
          "inline-flex items-center gap-[5px] rounded-[var(--radius-sm)]",
          "px-[9px] py-[5px] text-[11.5px] font-medium",
          "text-[var(--ink-subtle)] hover:text-[var(--ink)]",
          uniformRuntime ? "" : "ml-auto",
        )}
      >
        <CleanupGlyph />
        Cleanup
        {pendingCount > 0 && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--primary)",
            }}
          >
            {pendingCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => setShowArchived(true)}
        title="Show archived tasks"
        className={cn(
          "inline-flex items-center gap-[5px] rounded-[var(--radius-sm)]",
          "px-[9px] py-[5px] text-[11.5px] font-medium",
          "text-[var(--ink-subtle)] hover:text-[var(--ink)]",
        )}
      >
        <ArchiveGlyph />
        Archived
      </button>
      <TaskCleanupModal open={cleanupOpen} onClose={() => setCleanupOpen(false)} />
    </div>
  );
}

function CleanupGlyph() {
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
    >
      <path d="M5 4l2 4 4 2-4 2-2 4-2-4-4-2 4-2zM17 13l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
    </svg>
  );
}

function ArchiveGlyph() {
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
    >
      <path d="M3 7h18v3H3zM5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9M10 14h4" />
    </svg>
  );
}

interface FilterPillProps {
  readonly label: string;
  readonly count: number;
  readonly active: boolean;
  readonly onClick: () => void;
  readonly dot?: "primary" | "ok" | "err";
  readonly title?: string;
}

function FilterPill({
  label,
  count,
  active,
  onClick,
  dot,
  title,
}: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        "inline-flex items-center gap-[5px] rounded-[var(--radius-sm)]",
        "px-[9px] py-[5px] text-[11.5px] font-medium",
        active
          ? "bg-[var(--s2)] text-[var(--ink)]"
          : "text-[var(--ink-subtle)] hover:text-[var(--ink)]",
      )}
    >
      {dot && <DotIndicator tone={dot} />}
      <span>{label}</span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--ink-tertiary)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function DotIndicator({ tone }: { tone: "primary" | "ok" | "err" }) {
  const color =
    tone === "primary"
      ? "var(--primary)"
      : tone === "ok"
        ? "var(--ok)"
        : "var(--err)";
  return (
    <span
      aria-hidden
      className="h-[5px] w-[5px] rounded-full"
      style={{ background: color }}
    />
  );
}
