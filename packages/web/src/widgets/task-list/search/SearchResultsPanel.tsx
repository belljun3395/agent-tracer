import { useSearchQuery } from "~web/features/search/api/queries.js";
import {
  useSelectedTaskId,
  useSetSidebarSearchScope,
  useSidebarSearchScope,
} from "~web/shared/store/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import { useNowMs } from "~web/shared/lib/hooks/use-now-ms.js";
import { TaskHitRow, EventHitRow } from "~web/widgets/task-list/search/SearchResultRow.js";

interface SearchResultsPanelProps {
  /** 이미 디바운스된 검색어. */
  readonly query: string;
}

/** 검색이 활성화된 동안 그룹화된 태스크 목록을 대체한다. */
export function SearchResultsPanel({ query }: SearchResultsPanelProps) {
  const nowMs = useNowMs(15_000);
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
            <div className="text-center pb-1 font-mono text-[10px] text-ink-tertiary">
              updating…
            </div>
          )}
          {data.tasks.length > 0 && (
            <Section title="Tasks" count={data.tasks.length}>
              {data.tasks.map((hit) => (
                <TaskHitRow key={hit.id} hit={hit} nowMs={nowMs} />
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
    <div className="inline-flex p-0.5 mb-2 mx-1 rounded-sm bg-s1 border border-hair">
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
        "h-6 px-2.5 rounded-xs text-[11px] font-medium",
        "transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        active
          ? "bg-s3 text-ink shadow-[0_1px_0_0_var(--hair-strong)]"
          : "bg-transparent text-ink-subtle shadow-none",
      )}
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
      <div className="flex items-center gap-1.5 px-2 pt-2 pb-1 font-sans text-[10.5px] font-medium tracking-[0.4px] uppercase text-ink-tertiary">
        <span>{title}</span>
        <span className="rounded-xs bg-s1 px-1.5 font-mono text-[10px] text-ink-tertiary tracking-normal leading-4">
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
      className={cn(
        "px-3 py-4 text-center text-xs",
        tone === "err" ? "text-err" : "text-ink-subtle",
      )}
    >
      {label}
    </div>
  );
}
