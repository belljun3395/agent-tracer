import { useTaskDetailQuery } from "~web/entities/task/api/detail-queries.js";
import { useSelectedTaskId } from "~web/shared/store/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";

/** 2단계 브레드크럼. */
export function Crumbs() {
  const selectedTaskId = useSelectedTaskId();
  const { data } = useTaskDetailQuery(selectedTaskId ?? null);
  const task = data?.task;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 min-w-0 text-sm text-ink-subtle"
    >
      <CrumbItem
        icon={<HomeGlyph />}
        label={task?.workspacePath ?? "agent-tracer"}
      />
      {task && (
        <>
          <span className="text-hair-strong font-mono text-xs">
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
      className={cn(
        "inline-flex items-center gap-1.5 px-1.5 py-[3px] rounded-sm min-w-0",
        current ? "text-ink font-medium" : "font-normal",
      )}
    >
      <span className="text-ink-tertiary inline-flex">
        {icon}
      </span>
      <span className="truncate tracking-[-0.1px] max-w-80">
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
