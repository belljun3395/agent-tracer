import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import type { ResumeTargetDto } from "@monitor/kernel";
import { useNowMs } from "~web/shared/lib/hooks/use-now-ms.js";
import {
  useMainView,
  useSetMainView,
  type MainView,
} from "~web/shared/store/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import { formatDuration } from "~web/shared/lib/formatting/time.js";
import { formatHHmm } from "~web/shared/lib/formatting/time.js";
import { extractLatestModel } from "~web/widgets/feed/lib/extraction/extract-model.js";
import { MetricRail } from "~web/widgets/feed/header/MetricRail.js";
import { SessionIdPill } from "~web/widgets/feed/header/SessionIdPill.js";
import { EditableTitle } from "~web/widgets/feed/header/title/EditableTitle.js";
import { StatusPill } from "~web/widgets/feed/header/StatusPill.js";
import { LaneFilter } from "~web/widgets/feed/LaneFilter.js";

interface TaskHeaderProps {
  readonly task: MonitoringTask;
  readonly timeline: readonly TimelineEventRecord[];
  readonly resumeTarget?: ResumeTargetDto;
}

/** 피드 본문 위 고정 헤더. */
export function TaskHeader({ task, timeline, resumeTarget }: TaskHeaderProps) {
  const nowMs = useNowMs(60_000);
  const startMs = Date.parse(task.lastSessionStartedAt ?? task.createdAt);
  const elapsed = formatDuration(Math.max(0, nowMs - startMs));
  const startedClock = formatHHmm(startMs);
  const shortId = task.id.slice(-8);
  const filesTouched = countDistinctPaths(timeline);
  const model = extractLatestModel(timeline);

  return (
    <div className="sticky top-0 z-[5] px-9 pt-5 pb-3 group backdrop-blur-[4px] bg-[linear-gradient(to_bottom,var(--canvas)_80%,transparent)]">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <EditableTitle task={task} />
        </div>
        <StatusPill task={task} />
        <ViewToggle />
      </div>

      <div className="flex items-center gap-2.5 flex-wrap mt-2 text-xs text-ink-subtle">
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
        {resumeTarget && (
          <>
            <Sep />
            <SessionIdPill resumeTarget={resumeTarget} />
          </>
        )}
        <span className="ml-auto inline-flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ByItem label="ID" value={shortId} mono title={`Full task id: ${task.id}`} />
        </span>
      </div>

      <div
        className="mt-1 text-[11.5px] text-ink-tertiary font-mono"
        title={task.workspacePath}
      >
        {task.workspacePath ?? "agent-tracer"}
      </div>

      <MetricRail task={task} timeline={timeline} nowMs={nowMs} />

      {timeline.length > 0 && (
        <div className="mt-2.5">
          <LaneFilter />
        </div>
      )}
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
      <span className="text-[10.5px] uppercase tracking-[0.06em] text-ink-tertiary">
        {label}
      </span>
      <span className={cn("text-ink-muted", mono ? "font-mono text-[11.5px]" : "font-[inherit] text-xs")}>
        {value}
      </span>
    </span>
  );
}

function ViewToggle() {
  const mainView = useMainView();
  const setMainView = useSetMainView();
  return (
    <div className="inline-flex p-0.5 rounded-sm bg-s1 border border-hair">
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
        "px-2.5 h-6 rounded-xs inline-flex items-center gap-1",
        "text-[11.5px] font-medium transition-colors",
        active
          ? "bg-s3 text-ink shadow-[0_1px_0_0_var(--hair-strong)]"
          : "bg-transparent text-ink-subtle shadow-none",
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="text-hair-strong">·</span>;
}

function countDistinctPaths(events: readonly TimelineEventRecord[]): number {
  const set = new Set<string>();
  for (const e of events) {
    if (e.paths?.primaryPath) set.add(e.paths.primaryPath);
    for (const p of e.paths?.filePaths ?? []) set.add(p);
  }
  return set.size;
}
