import {
  useShowArchived,
  useSidebarFilter,
  useSetSidebarFilter,
  type SidebarFilter,
} from "~state/ui/index.js";
import { cn } from "~lib/cn.js";

interface TaskListFiltersProps {
  readonly counts: Readonly<Record<SidebarFilter, number>>;
}

/**
 * Four-pill row pinned under the search input. Each pill shows its label
 * + count; the active pill picks up `--s2` background. Counts come from
 * the `useTaskList` view-model so they're computed once per render tick.
 *
 * Cleanup and Archived toggle live in the header row (next to search) so
 * this row stays focused on filter navigation, regardless of sidebar
 * width. The shared runtime tag, when applicable, surfaces in the footer.
 */
export function TaskListFilters({ counts }: TaskListFiltersProps) {
  const active = useSidebarFilter();
  const setFilter = useSetSidebarFilter();
  const showArchived = useShowArchived();

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
      {showArchived && (
        <span
          className="ml-auto inline-flex items-center gap-1.5"
          style={{
            fontSize: 10.5,
            color: "var(--primary)",
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
          aria-live="polite"
        >
          Archived view
        </span>
      )}
    </div>
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
