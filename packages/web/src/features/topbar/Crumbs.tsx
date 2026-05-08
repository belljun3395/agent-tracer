import { useTasksQuery } from "~state/server/queries.js";
import { useSelectedTaskId } from "~state/ui/index.js";

/**
 * Two-segment breadcrumb: project root, then the current task title.
 * Reads from the cached tasks list (already loaded by TaskListPanel) so
 * no extra fetch is triggered for the topbar.
 */
export function Crumbs() {
  const selectedTaskId = useSelectedTaskId();
  const { data } = useTasksQuery();
  const task = selectedTaskId
    ? data?.tasks.find((t) => t.id === selectedTaskId)
    : undefined;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 min-w-0"
      style={{ fontSize: 13, color: "var(--ink-subtle)" }}
    >
      <CrumbItem
        icon={<HomeGlyph />}
        label={task?.workspacePath ?? "agent-tracer"}
      />
      {task && (
        <>
          <span
            style={{
              color: "var(--hair-strong)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            /
          </span>
          <CrumbItem
            icon={<DotGlyph />}
            label={task.displayTitle ?? task.title}
            current
          />
        </>
      )}
    </nav>
  );
}

interface CrumbItemProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly current?: boolean;
}

function CrumbItem({ icon, label, current }: CrumbItemProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-1.5 py-[3px] rounded-[var(--radius-sm)] min-w-0"
      style={{
        color: current ? "var(--ink)" : undefined,
        fontWeight: current ? 500 : 400,
      }}
    >
      <span style={{ color: "var(--ink-tertiary)", display: "inline-flex" }}>
        {icon}
      </span>
      <span
        className="truncate"
        style={{ letterSpacing: "-0.1px", maxWidth: 320 }}
      >
        {label}
      </span>
    </span>
  );
}

function HomeGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function DotGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
