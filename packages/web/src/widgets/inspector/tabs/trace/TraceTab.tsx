import { useMemo, useState } from "react";
import { useGuidance, useSelectedTaskId } from "~web/shared/store/index.js";
import { useTaskOpenInferenceQuery } from "~web/entities/task/api/detail-queries.js";
import { EmptyView } from "~web/shared/ui/index.js";
import { buildSpanTree, type SpanTreeRow } from "~web/widgets/inspector/tabs/trace/lib/build-span-tree.js";
import { SpanRow } from "~web/widgets/inspector/tabs/trace/SpanRow.js";
import { cn } from "~web/shared/ui/lib/cn.js";

/** Trace 탭. */
export function TraceTab() {
  const guidance = useGuidance();
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
        description={guidance.messages.inspector.traceLoadError}
        locale={guidance.locale}
      />
    );
  }
  if (allRows.length === 0) {
    return (
      <EmptyView
        eyebrow="Empty"
        title="No spans yet"
        description={guidance.messages.inspector.tracePending}
        locale={guidance.locale}
      />
    );
  }

  return (
    <div className="px-2 py-3 flex flex-col gap-px">
      <div className="px-2 pb-2 flex items-center gap-2 border-b border-hair font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary">
        <span>
          OpenInference · {rows.length} span{rows.length === 1 ? "" : "s"}
        </span>
        {data.openinference.runtimeSource && (
          <>
            <span className="text-hair-strong">·</span>
            <span className="text-ink-muted">
              {data.openinference.runtimeSource}
            </span>
          </>
        )}
        {telemetryCount > 0 && (
          <button
            type="button"
            onClick={() => setShowTelemetry((v) => !v)}
            aria-pressed={showTelemetry}
            className={cn(
              "ml-auto rounded-xs border border-hair px-1.5 py-0.5 font-mono text-[10px] normal-case tracking-normal",
              showTelemetry ? "text-ink bg-s2" : "text-ink-muted bg-transparent",
            )}
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

/** 텔레메트리 행. */
function isTelemetryRow(row: SpanTreeRow): boolean {
  const name = row.span.name;
  if (/^Context \d+% used$/.test(name)) return true;
  if (/^Notification:/.test(name)) return true;
  return false;
}
