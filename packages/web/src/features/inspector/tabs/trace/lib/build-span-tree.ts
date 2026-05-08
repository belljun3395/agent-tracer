import type { OpenInferenceSpanRecord } from "~domain/openinference.js";

export interface SpanTreeRow {
  readonly span: OpenInferenceSpanRecord;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly elapsedMsFromRoot: number | null;
}

/**
 * Flatten a list of OpenInference spans into a depth-first tree row sequence.
 *
 * Roots: spans whose `parentSpanId` is missing OR points outside the
 * provided set. The `parentSpanId is missing` case is the typical task
 * root; the `parent points outside` case happens when the server export
 * is partial (e.g. a child task's spans pulled in isolation).
 *
 * Each row carries its depth so the renderer can indent without keeping
 * its own traversal state. `elapsedMsFromRoot` is computed once here so
 * the row component never re-parses Date strings on every paint.
 */
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

  // Sort siblings by start time so the tree walks chronologically.
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
