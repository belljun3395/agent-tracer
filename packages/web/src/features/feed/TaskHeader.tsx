import type { MonitoringTask, TimelineEventRecord } from "~domain/monitoring.js";
import { useNowMs } from "~state/ui/useNowMs.js";
import {
  useMainView,
  useSetMainView,
  type MainView,
} from "~state/ui/index.js";
import { Pill } from "~ui/index.js";
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
 * Sticky header above the feed body.
 *
 *   eyebrow       TASK <id> · <status pill ↓> · <runtime> · <model> · <session>
 *   h1 (editable) Task title with inline rename on click
 *   byline        project · files
 *   metric rail   Active · Compacts · Context %
 *   view toggle   Feed / Graph
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
      className="sticky top-0 z-[5] px-9 pt-5 pb-3"
      style={{
        background:
          "linear-gradient(to bottom, var(--canvas) 80%, transparent)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        className="flex items-center gap-2 flex-wrap mb-2"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          color: "var(--ink-tertiary)",
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ color: "var(--ink-muted)" }}>TASK {shortId}</span>
        <StatusPill task={task} />
        {task.runtimeSource && (
          <Pill tone="neutral">{task.runtimeSource}</Pill>
        )}
        {model && <Pill tone="neutral">{model}</Pill>}
        {sessionId && <SessionIdPill sessionId={sessionId} />}
        <span style={{ marginLeft: "auto", color: "var(--ink-tertiary)" }}>
          started {startedClock} · {elapsed}
        </span>
      </div>

      <div className="flex items-start gap-3 flex-wrap">
        <EditableTitle task={task} />
        <ViewToggle />
      </div>

      <div
        className="flex items-center gap-3 flex-wrap mt-2"
        style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}
      >
        <KvPair k="project" v={task.workspacePath ?? "agent-tracer"} />
        {filesTouched > 0 && (
          <>
            <Sep />
            <KvPair k="files" v={`${filesTouched} touched`} />
          </>
        )}
      </div>

      <MetricRail task={task} timeline={timeline} />
    </div>
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

function KvPair({ k, v }: { k: string; v: string }) {
  return (
    <span>
      <span style={{ color: "var(--ink-tertiary)", marginRight: 4 }}>{k}</span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          color: "var(--ink-muted)",
        }}
      >
        {v}
      </span>
    </span>
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
