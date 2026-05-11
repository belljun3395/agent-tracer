import type { MonitoringTask, TimelineEventRecord } from "~domain/monitoring.js";
import { useNowMs } from "~state/ui/useNowMs.js";
import {
  useMainView,
  useSetMainView,
  type MainView,
} from "~state/ui/index.js";
import { cn } from "~lib/cn.js";
import { formatDuration, formatHHmm } from "./lib/format-time.js";
import { extractLatestModel } from "./lib/extract-model.js";
import { MetricRail } from "./MetricRail.js";
import { SessionIdPill } from "./SessionIdPill.js";
import { EditableTitle } from "./EditableTitle.js";
import { StatusPill } from "./StatusPill.js";

interface TaskHeaderProps {
  readonly task: MonitoringTask;
  readonly timeline: readonly TimelineEventRecord[];
  readonly sessionId?: string;
}

/**
 * Sticky header above the feed body. Rebalanced after the audit so the
 * most-important state lands first:
 *
 *   row 1   h1 (editable) ← Status pill (prominent) ← View toggle
 *   row 2   project path · files touched · started clock · active duration
 *   row 3   metric rail (Active · Compacts · Context %)
 *   eyebrow short task id surfaces on hover only (copyable)
 *
 * Hash IDs (`8370044f`), runtime tag, model, and session id were
 * burying the live `Running` state in a long mono eyebrow line. Status
 * now anchors the title row; the rest moves into a quieter byline or
 * hover affordance.
 */
export function TaskHeader({ task, timeline, sessionId }: TaskHeaderProps) {
  const nowMs = useNowMs(60_000);
  const startMs = Date.parse(task.lastSessionStartedAt ?? task.createdAt);
  const elapsed = formatDuration(Math.max(0, nowMs - startMs));
  const startedClock = formatHHmm(startMs);
  const shortId = task.id.slice(-8);
  const filesTouched = countDistinctPaths(timeline);
  const model = extractLatestModel(timeline);

  return (
    <div
      className="sticky top-0 z-[5] px-9 pt-5 pb-3 group"
      style={{
        background:
          "linear-gradient(to bottom, var(--canvas) 80%, transparent)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <EditableTitle task={task} />
        </div>
        <StatusPill task={task} />
        <ViewToggle />
      </div>

      <div
        className="flex items-center gap-2.5 flex-wrap mt-2"
        style={{ fontSize: 12, color: "var(--ink-subtle)" }}
      >
        <ByItem
          label="Started"
          value={startedClock}
          mono
          title={`Task started at ${startedClock} · running ${elapsed}`}
        />
        <Sep />
        <ByItem label="Active" value={elapsed} mono />
        {filesTouched > 0 && (
          <>
            <Sep />
            <ByItem label="Files" value={`${filesTouched}`} mono />
          </>
        )}
        {task.runtimeSource && (
          <>
            <Sep />
            <ByItem label="Runtime" value={task.runtimeSource} mono />
          </>
        )}
        {model && (
          <>
            <Sep />
            <ByItem label="Model" value={model} mono />
          </>
        )}
        {sessionId && (
          <>
            <Sep />
            <SessionIdPill sessionId={sessionId} />
          </>
        )}
        <span className="ml-auto inline-flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ByItem label="ID" value={shortId} mono title={`Full task id: ${task.id}`} />
        </span>
      </div>

      <div
        className="mt-1"
        style={{
          fontSize: 11.5,
          color: "var(--ink-tertiary)",
          fontFamily: "var(--font-mono)",
        }}
        title={task.workspacePath}
      >
        {task.workspacePath ?? "agent-tracer"}
      </div>

      <MetricRail task={task} timeline={timeline} />
    </div>
  );
}

interface ByItemProps {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
  readonly title?: string;
}

function ByItem({ label, value, mono, title }: ByItemProps) {
  return (
    <span className="inline-flex items-baseline gap-1.5" title={title}>
      <span
        style={{
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-tertiary)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: mono ? "var(--font-mono)" : "inherit",
          fontSize: mono ? 11.5 : 12,
          color: "var(--ink-muted)",
        }}
      >
        {value}
      </span>
    </span>
  );
}

function ViewToggle() {
  const mainView = useMainView();
  const setMainView = useSetMainView();
  return (
    <div
      className="inline-flex p-0.5 rounded-[var(--radius-sm)]"
      style={{
        background: "var(--s1)",
        border: "1px solid var(--hair)",
      }}
    >
      <ToggleButton
        active={mainView === "feed"}
        onClick={() => setMainView("feed")}
        view="feed"
      >
        Feed
      </ToggleButton>
      <ToggleButton
        active={mainView === "graph"}
        onClick={() => setMainView("graph")}
        view="graph"
      >
        Graph
      </ToggleButton>
      <ToggleButton
        active={mainView === "overview"}
        onClick={() => setMainView("overview")}
        view="overview"
      >
        Overview
      </ToggleButton>
    </div>
  );
}

interface ToggleButtonProps {
  readonly active: boolean;
  readonly view: MainView;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}

function ToggleButton({ active, onClick, view, children }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${view} view`}
      className={cn(
        "px-2.5 h-6 rounded-[var(--radius-xs)] inline-flex items-center gap-1",
        "text-[11.5px] font-medium transition-colors",
      )}
      style={{
        background: active ? "var(--s3)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink-subtle)",
        boxShadow: active ? "0 1px 0 0 var(--hair-strong)" : "none",
      }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span style={{ color: "var(--hair-strong)" }}>·</span>;
}

function countDistinctPaths(events: readonly TimelineEventRecord[]): number {
  const set = new Set<string>();
  for (const e of events) {
    if (e.paths?.primaryPath) set.add(e.paths.primaryPath);
    for (const p of e.paths?.filePaths ?? []) set.add(p);
  }
  return set.size;
}
