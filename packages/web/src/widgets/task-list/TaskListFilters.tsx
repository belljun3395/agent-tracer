import {
  useGuidance,
  useShowArchived,
  useSidebarFilter,
  useSetSidebarFilter,
  type SidebarFilter,
} from "~web/shared/store/index.js";
import type { GuidanceMessage } from "~web/shared/guidance.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import { GuidanceText, Tooltip } from "~web/shared/ui/index.js";

interface TaskListFiltersProps {
  readonly counts: Readonly<Record<SidebarFilter, number>>;
}

/** 검색창 아래 고정된 필 4개짜리 행. */
export function TaskListFilters({ counts }: TaskListFiltersProps) {
  const guidance = useGuidance();
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
        description={guidance.messages.tasks.attentionFilter}
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
          className="ml-auto inline-flex items-center gap-1.5 text-[10.5px] text-primary font-medium tracking-[0.04em] uppercase"
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
  readonly description?: GuidanceMessage;
}

function FilterPill({
  label,
  count,
  active,
  onClick,
  dot,
  description,
}: FilterPillProps) {
  const guidance = useGuidance();
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
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
      <span className="font-mono text-[10px] text-ink-tertiary">
        {count}
      </span>
    </button>
  );
  if (description === undefined) return button;
  return (
    <Tooltip
      content={<GuidanceText locale={guidance.locale} message={description} />}
    >
      {button}
    </Tooltip>
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
