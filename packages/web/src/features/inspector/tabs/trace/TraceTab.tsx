import { useMemo, useState } from "react";
import { useSelectedTaskId } from "~state/ui/index.js";
import { useTaskOpenInferenceQuery } from "~state/server/queries.js";
import { EmptyView } from "~features/shell/index.js";
import { buildSpanTree, type SpanTreeRow } from "./lib/build-span-tree.js";
import { SpanRow } from "./SpanRow.js";

/**
 * Trace tab — projects the task's events as an OpenInference span tree.
 *
 * The query is gated on a selected task (no taskId → no fetch). Spans are
 * laid out as a depth-first tree; clicking a row reuses the same
 * selection slice as the feed so switching tabs preserves focus.
 *
 * Telemetry rows ("Context N% used" status-line snapshots, plain
 * notification pings) are folded out by default — a long-running task
 * emits hundreds of them, which used to drown the meaningful
 * tool/agent/LLM spans. A "Show telemetry" toggle restores them.
 */
export function TraceTab() {
  const taskId = useSelectedTaskId();
  const { data, isLoading, isError } = useTaskOpenInferenceQuery(taskId);
  const [showTelemetry, setShowTelemetry] = useState(false);

  const allRows = useMemo(() => {
    if (!data) return [];
    return buildSpanTree(data.openinference.spans);
  }, [data]);

  const telemetryCount = useMemo(
    () => allRows.reduce((n, r) => (isTelemetryRow(r) ? n + 1 : n), 0),
    [allRows],
  );

  const rows = useMemo(
    () =>
      showTelemetry ? allRows : allRows.filter((r) => !isTelemetryRow(r)),
    [allRows, showTelemetry],
  );

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
  if (allRows.length === 0) {
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
        <span>
          OpenInference · {rows.length} span{rows.length === 1 ? "" : "s"}
        </span>
        {data.openinference.runtimeSource && (
          <>
            <span style={{ color: "var(--hair-strong)" }}>·</span>
            <span style={{ color: "var(--ink-muted)" }}>
              {data.openinference.runtimeSource}
            </span>
          </>
        )}
        {telemetryCount > 0 && (
          <button
            type="button"
            onClick={() => setShowTelemetry((v) => !v)}
            aria-pressed={showTelemetry}
            className="ml-auto rounded-[var(--radius-xs)] border border-[var(--hair)] px-1.5 py-0.5"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "none",
              letterSpacing: 0,
              color: showTelemetry ? "var(--ink)" : "var(--ink-muted)",
              background: showTelemetry ? "var(--s2)" : "transparent",
            }}
            title={`${telemetryCount} context-snapshot / telemetry spans hidden`}
          >
            {showTelemetry ? "Hide" : "Show"} telemetry ({telemetryCount})
          </button>
        )}
      </div>
      {rows.map((row) => (
        <SpanRow key={row.span.spanId} row={row} />
      ))}
    </div>
  );
}

/**
 * Telemetry rows — high-volume noise that's almost never what the user
 * wants to scan. Identified by name shape; the Inspect-side classifier
 * already knows these as `context.snapshot` / `notification` event
 * kinds, but the OpenInference export sometimes flattens both into the
 * generic `UNKNOWN` span kind so we match by name instead.
 */
function isTelemetryRow(row: SpanTreeRow): boolean {
  const name = row.span.name;
  if (/^Context \d+% used$/.test(name)) return true;
  if (/^Notification:/.test(name)) return true;
  return false;
}
