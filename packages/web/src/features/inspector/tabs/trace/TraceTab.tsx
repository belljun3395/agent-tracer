import { useMemo } from "react";
import { useSelectedTaskId } from "~state/ui/index.js";
import { useTaskOpenInferenceQuery } from "~state/server/queries.js";
import { EmptyView } from "~features/shell/index.js";
import { buildSpanTree } from "./lib/build-span-tree.js";
import { SpanRow } from "./SpanRow.js";

/**
 * Trace tab — projects the task's events as an OpenInference span tree.
 *
 * The query is gated on a selected task (no taskId → no fetch). Spans are
 * laid out as a depth-first tree; clicking a row reuses the same
 * selection slice as the feed so switching tabs preserves focus.
 */
export function TraceTab() {
  const taskId = useSelectedTaskId();
  const { data, isLoading, isError } = useTaskOpenInferenceQuery(taskId);

  const rows = useMemo(() => {
    if (!data) return [];
    return buildSpanTree(data.openinference.spans);
  }, [data]);

  if (!taskId) {
    return (
      <EmptyView eyebrow="Trace" title="Select a task to view its trace." />
    );
  }
  if (isLoading) {
    return <EmptyView eyebrow="Loading" title="Building span tree…" />;
  }
  if (isError || !data) {
    return (
      <EmptyView
        eyebrow="Error"
        title="Couldn't load trace"
        description="Check the monitor server connection or pick another task."
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyView
        eyebrow="Empty"
        title="No spans yet"
        description="Spans will appear as the agent runs."
      />
    );
  }

  return (
    <div className="px-2 py-3 flex flex-col gap-px">
      <div
        className="px-2 pb-2 flex items-center gap-2 border-b border-[var(--hair)]"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--ink-tertiary)",
        }}
      >
        <span>OpenInference · {rows.length} spans</span>
        {data.openinference.runtimeSource && (
          <>
            <span style={{ color: "var(--hair-strong)" }}>·</span>
            <span style={{ color: "var(--ink-muted)" }}>
              {data.openinference.runtimeSource}
            </span>
          </>
        )}
      </div>
      {rows.map((row) => (
        <SpanRow key={row.span.spanId} row={row} />
      ))}
    </div>
  );
}
