import type { MonitoringTask } from "~web/entities/task/model/task.js";

export interface HierarchicalTask {
  readonly task: MonitoringTask;
  /** 0은 루트 태스크, 1 이상은 서브에이전트 깊이. */
  readonly depth: number;
  /** 자식 태스크가 하나라도 있으면 true. */
  readonly hasChildren: boolean;
}

/** 평평한 태스크 목록을 parent → child 관계를 따르는 깊이 우선 시퀀스로 재구성한다. */
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
    if (collapsed.has(task.id)) {
      // 이 서브트리는 의도적으로 숨겨졌을 뿐 사라진 게 아니다.
      markVisited(children);
      return;
    }
    for (const child of children) {
      visit(child, depth + 1);
    }
  };

  const markVisited = (children: readonly MonitoringTask[]): void => {
    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      markVisited(childrenByParent.get(child.id) ?? []);
    }
  };

  // 루트는 parentTaskId가 없거나 보이는 집합 밖을 가리키는 태스크다
  // (parent가 필터링되었거나 범위 밖으로 빠진 경우).
  for (const task of tasks) {
    if (visited.has(task.id)) continue;
    const parent = task.parentTaskId;
    const isRoot = !parent || !present.has(parent);
    if (isRoot) visit(task, 0);
  }

  // 방어 처리: 순회에서 빠진 태스크(순환 생존자)는 depth 0으로 내보내
  // 조용히 누락되지 않게 한다.
  for (const task of tasks) {
    if (!visited.has(task.id)) {
      out.push({ task, depth: 0, hasChildren: false });
      visited.add(task.id);
    }
  }

  return out;
}
