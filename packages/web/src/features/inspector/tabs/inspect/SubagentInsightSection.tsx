import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { TaskId } from "~domain/monitoring.js";
import { useTasksQuery } from "~state/server/queries.js";

interface SubagentInsightSectionProps {
  readonly taskId: TaskId;
}

/**
 * List child tasks that share `parentTaskId === taskId`. Each entry
 * surfaces the subagent's status + a link into its own task view, so
 * the operator can drill into a subagent's run without losing the
 * parent task's context.
 *
 * The section auto-hides when the task has no children.
 */
export function SubagentInsightSection({ taskId }: SubagentInsightSectionProps) {
  const { data } = useTasksQuery();
  const children = useMemo(() => {
    if (!data) return [];
    return data.tasks.filter((t) => t.parentTaskId === taskId);
  }, [data, taskId]);

  if (children.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-[var(--hair)]">
      <div
        className="flex items-center gap-2 mb-2"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--ph-coord)",
        }}
      >
        <span>Subagents</span>
        <span style={{ color: "var(--ink-muted)" }}>{children.length}</span>
      </div>
      <ul className="m-0 p-0 list-none flex flex-col gap-1">
        {children.map((child) => (
          <li key={child.id}>
            <Link
              to={`/tasks/${child.id}`}
              className="block px-2.5 py-1.5 rounded-[var(--radius-xs)] hover:bg-[var(--s2)]"
              style={{
                background: "var(--canvas)",
                border: "1px solid var(--hair)",
              }}
            >
              <div
                className="flex items-center gap-2"
                style={{ fontSize: 12, color: "var(--ink)" }}
              >
                <StatusDot status={child.status} />
                <span
                  className="flex-1 min-w-0 truncate"
                  style={{
                    letterSpacing: "-0.05px",
                  }}
                >
                  {child.displayTitle ?? child.title}
                </span>
              </div>
              {child.runtimeSource && (
                <div
                  className="mt-0.5"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--ink-tertiary)",
                  }}
                >
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

function StatusDot({
  status,
}: {
  readonly status: "running" | "waiting" | "completed" | "errored";
}) {
  const color =
    status === "running"
      ? "var(--primary)"
      : status === "waiting"
        ? "var(--warn)"
        : status === "completed"
          ? "var(--ok)"
          : "var(--err)";
  return (
    <span
      aria-hidden
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}
