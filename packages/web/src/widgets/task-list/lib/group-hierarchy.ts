import type { MonitoringTask } from "~web/entities/task/model/task.js";
import { buildHierarchy, type HierarchicalTask } from "~web/widgets/task-list/lib/build-hierarchy.js";
import { TASK_GROUP_ORDER, timeBucketKey, type TaskGroupKey } from "~web/widgets/task-list/lib/group-tasks.js";

export interface HierarchicalTaskGroup {
  readonly key: TaskGroupKey;
  readonly label: string;
  readonly rows: readonly HierarchicalTask[];
}

interface SubtreeStat {
  /** 서브트리 전체에서 가장 최근 updatedAt(ms). */
  readonly recencyMs: number;
  /** 서브트리에 running/waiting 태스크가 하나라도 있으면 true. */
  readonly live: boolean;
}

/** 계층 우선 그룹핑. */
export function groupHierarchically(
  tasks: readonly MonitoringTask[],
  collapsed: ReadonlySet<string>,
  nowMs: number,
): readonly HierarchicalTaskGroup[] {
  const present = new Set(tasks.map((t) => t.id));
  const childrenByParent = new Map<string, MonitoringTask[]>();
  const roots: MonitoringTask[] = [];
  for (const task of tasks) {
    const parent = task.parentTaskId;
    if (parent && present.has(parent)) {
      const bucket = childrenByParent.get(parent) ?? [];
      bucket.push(task);
      childrenByParent.set(parent, bucket);
    } else {
      roots.push(task);
    }
  }

  const stats = computeSubtreeStats(roots, childrenByParent);

  // 버킷별로 루트를 모아 서브트리 최신순 정렬한다.
  const rootsByBucket = new Map<TaskGroupKey, MonitoringTask[]>();
  for (const root of roots) {
    const stat = stats.get(root.id) ?? { recencyMs: updatedMs(root), live: isLive(root) };
    const key: TaskGroupKey = stat.live ? "live" : timeBucketKey(stat.recencyMs, nowMs);
    const bucket = rootsByBucket.get(key) ?? [];
    bucket.push(root);
    rootsByBucket.set(key, bucket);
  }

  const groups: HierarchicalTaskGroup[] = [];
  for (const { key, label } of TASK_GROUP_ORDER) {
    const bucketRoots = rootsByBucket.get(key);
    if (bucketRoots === undefined || bucketRoots.length === 0) continue;
    bucketRoots.sort((a, b) => {
      const ra = stats.get(a.id)?.recencyMs ?? updatedMs(a);
      const rb = stats.get(b.id)?.recencyMs ?? updatedMs(b);
      return rb - ra;
    });
    // 각 루트의 서브트리 전체(루트+자손)를 한 버킷에 담아 buildHierarchy에 넘긴다.
    const bucketTasks: MonitoringTask[] = [];
    for (const root of bucketRoots) {
      bucketTasks.push(root);
      const descendants = collectDescendants(root.id, childrenByParent);
      descendants.sort((a, b) => updatedMs(b) - updatedMs(a));
      bucketTasks.push(...descendants);
    }
    groups.push({ key, label, rows: buildHierarchy(bucketTasks, collapsed) });
  }
  return groups;
}

// 루트마다 서브트리 최신시각과 생존여부를 계산한다.
function computeSubtreeStats(
  roots: readonly MonitoringTask[],
  childrenByParent: ReadonlyMap<string, MonitoringTask[]>,
): Map<string, SubtreeStat> {
  const stats = new Map<string, SubtreeStat>();
  for (const root of roots) {
    let recencyMs = updatedMs(root);
    let live = isLive(root);
    const visited = new Set<string>([root.id]);
    const stack = [...(childrenByParent.get(root.id) ?? [])];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      recencyMs = Math.max(recencyMs, updatedMs(node));
      live = live || isLive(node);
      const children = childrenByParent.get(node.id);
      if (children) stack.push(...children);
    }
    stats.set(root.id, { recencyMs, live });
  }
  return stats;
}

function collectDescendants(
  rootId: string,
  childrenByParent: ReadonlyMap<string, MonitoringTask[]>,
): MonitoringTask[] {
  const out: MonitoringTask[] = [];
  const visited = new Set<string>([rootId]);
  const stack = [...(childrenByParent.get(rootId) ?? [])];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    out.push(node);
    const children = childrenByParent.get(node.id);
    if (children) stack.push(...children);
  }
  return out;
}

function isLive(task: MonitoringTask): boolean {
  return task.status === "running" || task.status === "waiting";
}

function updatedMs(task: MonitoringTask): number {
  return Date.parse(task.updatedAt);
}
