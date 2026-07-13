import { ChevronDownIcon } from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import type { TaskRowActionHandler } from "~web/widgets/task-list/row/useTaskRowActions.js";

interface TaskHierarchyGuidesProps {
  readonly depth: number;
}

/** 하위 에이전트의 중첩 깊이와 부모 연결선을 표시한다. */
export function TaskHierarchyGuides({ depth }: TaskHierarchyGuidesProps) {
  if (depth <= 0) return null;
  const guideXs = Array.from(
    { length: depth },
    (_, index) => 10 + (index + 0.5) * 20,
  );

  return (
    <>
      {guideXs.map((left, index) => (
        <span
          key={`guide-${index}`}
          aria-hidden
          className={cn(
            "absolute top-0 bottom-0 w-px",
            index === guideXs.length - 1 ? "bg-hair-strong" : "bg-hair",
          )}
          style={{ left }}
        />
      ))}
      <span
        aria-hidden
        className="absolute h-px top-1/2 w-2.5 bg-hair-strong"
        style={{ left: guideXs[guideXs.length - 1] ?? 0 }}
      />
    </>
  );
}

interface TaskHierarchyToggleProps {
  readonly hasChildren: boolean;
  readonly collapsed: boolean;
  readonly onToggle: TaskRowActionHandler;
}

/** 하위 에이전트가 있는 행의 접기 컨트롤을 표시한다. */
export function TaskHierarchyToggle({
  hasChildren,
  collapsed,
  onToggle,
}: TaskHierarchyToggleProps) {
  if (!hasChildren) return <span aria-hidden className="w-4 h-4" />;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Expand subagents" : "Collapse subagents"}
      aria-expanded={!collapsed}
      className={cn(
        "inline-flex items-center justify-center h-4 w-4 p-0 border-none bg-transparent text-ink-muted cursor-pointer transition-transform duration-[120ms]",
        collapsed ? "-rotate-90" : "rotate-0",
      )}
    >
      <ChevronDownIcon />
    </button>
  );
}
