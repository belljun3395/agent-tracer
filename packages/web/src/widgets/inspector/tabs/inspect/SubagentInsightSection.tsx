import { Link } from "react-router-dom";
import type { TaskId } from "~web/shared/identity.js";
import { useTaskChildrenQuery } from "~web/entities/task/api/detail-queries.js";

interface SubagentInsightSectionProps {
  readonly taskId: TaskId;
}

/** `parentTaskId === taskId`인 자식 태스크 목록. */
export function SubagentInsightSection({ taskId }: SubagentInsightSectionProps) {
  const { data } = useTaskChildrenQuery(taskId);
  const children = data?.tasks ?? [];

  if (children.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-hair">
      <div className="flex items-center gap-2 mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ph-coord">
        <span>Subagents</span>
        <span className="text-ink-muted">{children.length}</span>
      </div>
      <ul className="m-0 p-0 list-none flex flex-col gap-1">
        {children.map((child) => (
          <li key={child.id}>
            <Link
              to={`/tasks/${child.id}`}
              className="block px-2.5 py-1.5 rounded-xs hover:bg-s2 bg-canvas border border-hair"
            >
              <div className="flex items-center gap-2 text-xs text-ink">
                <StatusDot status={child.status} />
                <span className="flex-1 min-w-0 truncate tracking-[-0.05px]">
                  {child.displayTitle ?? child.title}
                </span>
              </div>
              {child.runtimeSource && (
                <div className="mt-0.5 font-mono text-[10px] text-ink-tertiary">
                  {child.runtimeSource} · {child.status}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATUS_DOT_COLOR: Record<"running" | "waiting" | "completed" | "errored", string> = {
  running: "bg-primary",
  waiting: "bg-warn",
  completed: "bg-ok",
  errored: "bg-err",
};

function StatusDot({
  status,
}: {
  readonly status: "running" | "waiting" | "completed" | "errored";
}) {
  return (
    <span
      aria-hidden
      className={`w-[7px] h-[7px] rounded-full shrink-0 ${STATUS_DOT_COLOR[status]}`}
    />
  );
}
