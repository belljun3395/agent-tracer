import { useSearchQuery } from "~state/server/queries.js";
import {
  useSelectedTaskId,
  useSetSidebarSearchScope,
  useSidebarSearchScope,
} from "~state/ui/index.js";
import { cn } from "~lib/cn.js";
import { TaskHitRow, EventHitRow } from "./SearchResultRow.js";

interface SearchResultsPanelProps {
  /** Already-debounced search query — pass empty string when not searching. */
  readonly query: string;
}

/**
 * Replaces the grouped task list while a search is active.
 *
 *   [scope toggle]    All / This task
 *   ── status / hint band
 *   TASKS    — title / metadata matches
 *   EVENTS   — body / snippet matches with task context
 *
 * The scope toggle decides whether the search hits the server with a
 * `taskId` filter (= this task only) or without (= every task). When
 * "this task" is selected but no task is currently focused, we fall
 * back to global search and surface a hint.
 */
export function SearchResultsPanel({ query }: SearchResultsPanelProps) {
  const scope = useSidebarSearchScope();
  const setScope = useSetSidebarSearchScope();
  const selectedTaskId = useSelectedTaskId();
  const effectiveScopeIsTask = scope === "this-task" && selectedTaskId !== null;

  const { data, isLoading, isError, isFetching } = useSearchQuery(
    query,
    effectiveScopeIsTask ? { taskId: selectedTaskId } : undefined,
  );

  if (query.trim().length === 0) {
    return null;
  }

  return (
    <div className="px-2 pt-1.5 pb-3.5">
      <ScopeToggle
        scope={scope}
        onChange={setScope}
        canScopeToTask={selectedTaskId !== null}
      />
      {isLoading ? (
        <Status label="Searching…" />
      ) : isError || !data ? (
        <Status label="Search failed." tone="err" />
      ) : data.tasks.length + data.events.length === 0 ? (
        <Status label={`No matches for “${query.trim()}”.`} />
      ) : (
        <>
          {isFetching && (
            <div
              className="text-center pb-1"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--ink-tertiary)",
              }}
            >
              updating…
            </div>
          )}
          {data.tasks.length > 0 && (
            <Section title="Tasks" count={data.tasks.length}>
              {data.tasks.map((hit) => (
                <TaskHitRow key={hit.id} hit={hit} />
              ))}
            </Section>
          )}
          {data.events.length > 0 && (
            <Section title="Events" count={data.events.length}>
              {data.events.map((hit) => (
                <EventHitRow key={hit.id} hit={hit} />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

interface ScopeToggleProps {
  readonly scope: "all" | "this-task";
  readonly onChange: (scope: "all" | "this-task") => void;
  readonly canScopeToTask: boolean;
}

function ScopeToggle({ scope, onChange, canScopeToTask }: ScopeToggleProps) {
  return (
    <div
      className="inline-flex p-0.5 mb-2 mx-1 rounded-[var(--radius-sm)]"
      style={{
        background: "var(--s1)",
        border: "1px solid var(--hair)",
      }}
    >
      <ScopeButton
        active={scope === "all"}
        onClick={() => onChange("all")}
      >
        All
      </ScopeButton>
      <ScopeButton
        active={scope === "this-task" && canScopeToTask}
        onClick={() => onChange("this-task")}
        disabled={!canScopeToTask}
        title={
          canScopeToTask
            ? "Limit results to the selected task"
            : "Pick a task first to scope search"
        }
      >
        This task
      </ScopeButton>
    </div>
  );
}

interface ScopeButtonProps {
  readonly active: boolean;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}

function ScopeButton({
  active,
  disabled,
  title,
  onClick,
  children,
}: ScopeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        "h-6 px-2.5 rounded-[var(--radius-xs)] text-[11px] font-medium",
        "transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
      )}
      style={{
        background: active ? "var(--s3)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink-subtle)",
        boxShadow: active ? "0 1px 0 0 var(--hair-strong)" : "none",
      }}
    >
      {children}
    </button>
  );
}

interface SectionProps {
  readonly title: string;
  readonly count: number;
  readonly children: React.ReactNode;
}

function Section({ title, count, children }: SectionProps) {
  return (
    <div className="mb-3">
      <div
        className="flex items-center gap-1.5 px-2 pt-2 pb-1"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 10.5,
          fontWeight: 500,
          letterSpacing: "0.4px",
          textTransform: "uppercase",
          color: "var(--ink-tertiary)",
        }}
      >
        <span>{title}</span>
        <span
          className="rounded-[var(--radius-xs)] bg-[var(--s1)] px-1.5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--ink-tertiary)",
            letterSpacing: 0,
            lineHeight: "16px",
          }}
        >
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

function Status({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "muted" | "err";
}) {
  return (
    <div
      className="px-3 py-4 text-center"
      style={{
        fontSize: 12,
        color: tone === "err" ? "var(--err)" : "var(--ink-subtle)",
      }}
    >
      {label}
    </div>
  );
}
