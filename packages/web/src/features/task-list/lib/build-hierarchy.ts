import type { MonitoringTask } from "~domain/monitoring.js";

export interface HierarchicalTask {
  readonly task: MonitoringTask;
  /** 0 = root task; 1+ = subagent depth. */
  readonly depth: number;
  /** True when at least one child task exists. */
  readonly hasChildren: boolean;
}

/**
 * Reshape a flat list of tasks into a depth-first sequence that respects
 * parent → child relationships. Within each parent, children appear
 * immediately after, indented one level deeper.
 *
 * The traversal preserves the input ORDER for siblings (we don't re-sort
 * children) — the caller is expected to have already arranged parents
 * by recency, and children naturally inherit that order.
 *
 * Cycles (a self- or mutual-parent loop) are guarded with a `visited`
 * set so a malformed payload can't lock us into infinite recursion.
 */
export function buildHierarchy(
  tasks: readonly MonitoringTask[],
  collapsed: ReadonlySet<string>,
): readonly HierarchicalTask[] {
  const childrenByParent = new Map<string, MonitoringTask[]>();
  const present = new Set<string>(tasks.map((t) => t.id));
  for (const task of tasks) {
    const parent = task.parentTaskId;
    if (!parent || !present.has(parent)) continue;
    let bucket = childrenByParent.get(parent);
    if (!bucket) {
      bucket = [];
      childrenByParent.set(parent, bucket);
    }
    bucket.push(task);
  }

  const out: HierarchicalTask[] = [];
  const visited = new Set<string>();

  const visit = (task: MonitoringTask, depth: number): void => {
    if (visited.has(task.id)) return;
    visited.add(task.id);
    const children = childrenByParent.get(task.id) ?? [];
    out.push({ task, depth, hasChildren: children.length > 0 });
    if (collapsed.has(task.id)) return;
    for (const child of children) {
      visit(child, depth + 1);
    }
  };

  // Roots are tasks whose parentTaskId is missing or points outside the
  // visible set (so their parent has been filtered out / scoped away).
  for (const task of tasks) {
    if (visited.has(task.id)) continue;
    const parent = task.parentTaskId;
    const isRoot = !parent || !present.has(parent);
    if (isRoot) visit(task, 0);
  }

  // Defensive: any task left unvisited (cycle survivor) gets emitted
  // at depth 0 so it's never silently dropped.
  for (const task of tasks) {
    if (!visited.has(task.id)) {
      out.push({ task, depth: 0, hasChildren: false });
      visited.add(task.id);
    }
  }

  return out;
}
