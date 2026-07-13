import type { OpenInferenceSpanRecord } from "~web/entities/task/model/openinference.js";

export interface SpanTreeRow {
  readonly span: OpenInferenceSpanRecord;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly elapsedMsFromRoot: number | null;
}

/** OpenInference span 목록을 깊이 우선 트리 행 시퀀스로 평탄화한다. */
export function buildSpanTree(
  spans: readonly OpenInferenceSpanRecord[],
): readonly SpanTreeRow[] {
  if (spans.length === 0) return [];

  const byId = new Map<string, OpenInferenceSpanRecord>();
  const childrenByParent = new Map<string, OpenInferenceSpanRecord[]>();
  for (const span of spans) {
    byId.set(span.spanId, span);
  }
  for (const span of spans) {
    const parentId = span.parentSpanId;
    if (parentId && byId.has(parentId)) {
      let bucket = childrenByParent.get(parentId);
      if (!bucket) {
        bucket = [];
        childrenByParent.set(parentId, bucket);
      }
      bucket.push(span);
    }
  }

  // 형제를 시작 시각으로 정렬해 트리를 시간순으로 순회한다.
  for (const bucket of childrenByParent.values()) {
    bucket.sort(
      (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime),
    );
  }

  const roots = spans
    .filter((s) => !s.parentSpanId || !byId.has(s.parentSpanId))
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));

  const earliestMs = roots.length > 0
    ? Date.parse(roots[0]!.startTime)
    : Date.parse(spans[0]!.startTime);

  const rows: SpanTreeRow[] = [];
  const visit = (span: OpenInferenceSpanRecord, depth: number): void => {
    const children = childrenByParent.get(span.spanId) ?? [];
    rows.push({
      span,
      depth,
      hasChildren: children.length > 0,
      elapsedMsFromRoot: Date.parse(span.startTime) - earliestMs,
    });
    for (const child of children) {
      visit(child, depth + 1);
    }
  };
  for (const root of roots) visit(root, 0);
  return rows;
}
