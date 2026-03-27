/**
 * 대시보드 상단 헤더 (52px 단일 행).
 * 브랜드 | 태스크명 | Check/Violation/Pass 뱃지 | 검색 | WS 상태
 */

import type React from "react";
import type {
  BookmarkSearchHit,
  OverviewResponse,
  SearchResponse
} from "../types.js";
import { formatCount, formatDuration, formatRate } from "../lib/observability.js";
import { cn } from "../lib/ui/cn.js";
import { useTheme } from "../lib/useTheme.js";
import { Button } from "./ui/Button.js";

interface ObservabilityBadgeCounts {
  readonly checks: number;
  readonly violations: number;
  readonly passes: number;
}

interface TopBarProps {
  readonly overview?: OverviewResponse | null;
  readonly isConnected: boolean;
  readonly searchQuery: string;
  readonly searchResults: SearchResponse | null;
  readonly isSearching: boolean;
  readonly selectedTaskTitle?: string | null;
  readonly taskScopeEnabled: boolean;
  readonly observabilityStats: ObservabilityBadgeCounts | null;
  readonly zoom: number;
  readonly onZoomChange: (zoom: number) => void;
  readonly onTaskScopeToggle: (enabled: boolean) => void;
  readonly onSearchQueryChange: (value: string) => void;
  readonly onSelectSearchTask: (taskId: string) => void;
  readonly onSelectSearchEvent: (taskId: string, eventId: string) => void;
  readonly onSelectSearchBookmark: (bookmark: BookmarkSearchHit) => void;
  readonly onRefresh: () => void;
  readonly onOpenLibrary: () => void;
}

function TopBarMetricChip({
  label,
  value,
  tone = "neutral"
}: {
  readonly label: string;
  readonly value: string;
  readonly tone?: "neutral" | "accent" | "ok" | "warn" | "danger";
}): React.JSX.Element {
  const toneClassName = {
    neutral: "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]",
    accent: "border-[color-mix(in_srgb,var(--accent)_24%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]",
    ok: "border-[color-mix(in_srgb,var(--ok)_28%,var(--border))] bg-[var(--ok-bg)] text-[var(--ok)]",
    warn: "border-[color-mix(in_srgb,var(--warn)_28%,var(--border))] bg-[var(--warn-bg)] text-[var(--warn)]",
    danger: "border-[color-mix(in_srgb,var(--err)_28%,var(--border))] bg-[var(--err-bg)] text-[var(--err)]"
  } satisfies Record<"neutral" | "accent" | "ok" | "warn" | "danger", string>;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold whitespace-nowrap", toneClassName[tone])}>
      <span className="uppercase tracking-[0.08em] opacity-70">{label}</span>
      <strong className="text-[0.72rem] font-semibold">{value}</strong>
    </span>
  );
}

export function TopBar({
  overview = null,
  isConnected,
  searchQuery,
  searchResults,
  isSearching,
  selectedTaskTitle,
  taskScopeEnabled,
  observabilityStats,
  zoom,
  onZoomChange,
  onTaskScopeToggle,
  onSearchQueryChange,
  onSelectSearchTask,
  onSelectSearchEvent,
  onSelectSearchBookmark,
  onRefresh,
  onOpenLibrary
}: TopBarProps): React.JSX.Element {
  const { theme, toggle: toggleTheme } = useTheme();
  const totalResults = (searchResults?.tasks.length ?? 0)
    + (searchResults?.events.length ?? 0)
    + (searchResults?.bookmarks.length ?? 0);
  const overviewObservability = overview?.observability ?? null;
  const runtimeSourceChips = overviewObservability?.runtimeSources.slice(0, 2) ?? [];

  return (
    <header className="z-10 flex h-[52px] shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">

      {/* Brand */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)]">
          <img
            alt=""
            className="h-[15px] w-[15px] [filter:brightness(0)_saturate(100%)_invert(27%)_sepia(98%)_saturate(1500%)_hue-rotate(215deg)_brightness(95%)]"
            src="/icons/activity.svg"
          />
        </span>
        <span className="text-[0.875rem] font-semibold tracking-[-0.02em] text-[var(--text-1)]">Agent Tracer</span>
      </div>

      {/* Divider */}
      <div className="h-4 w-px shrink-0 bg-[var(--border)]" />

      {/* Task title */}
      {selectedTaskTitle && (
        <span className="max-w-[200px] truncate text-[0.8rem] text-[var(--text-2)]" title={selectedTaskTitle}>
          {selectedTaskTitle}
        </span>
      )}

      {overviewObservability && (
        <div className="hidden min-w-0 shrink items-center gap-1.5 xl:flex">
          <TopBarMetricChip
            label="Prompt"
            tone="accent"
            value={formatRate(overviewObservability.promptCaptureRate)}
          />
          <TopBarMetricChip
            label="Flow"
            tone="ok"
            value={formatRate(overviewObservability.explicitFlowCoverageRate)}
          />
          <TopBarMetricChip
            label="Stale"
            tone={overviewObservability.staleRunningTasks > 0 ? "danger" : "neutral"}
            value={formatCount(overviewObservability.staleRunningTasks)}
          />
          <TopBarMetricChip
            label="Avg"
            tone="neutral"
            value={formatDuration(overviewObservability.avgDurationMs)}
          />
          {runtimeSourceChips.map((source) => (
            <TopBarMetricChip
              key={source.runtimeSource}
              label={source.runtimeSource}
              tone="neutral"
              value={`${formatCount(source.taskCount)} · ${formatRate(source.promptCaptureRate)}`}
            />
          ))}
        </div>
      )}

      {/* Observability badges */}
      {observabilityStats && (
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--coordination-border)] bg-[var(--coordination-bg)] px-2 py-0.5 text-[0.72rem] font-semibold text-[var(--coordination)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--coordination)] opacity-70" />
            {observabilityStats.checks} checks
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--err-bg)] bg-[var(--err-bg)] px-2 py-0.5 text-[0.72rem] font-semibold text-[var(--err)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--err)] opacity-70" />
            {observabilityStats.violations} violations
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ok-bg)] bg-[var(--ok-bg)] px-2 py-0.5 text-[0.72rem] font-semibold text-[var(--ok)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ok)] opacity-70" />
            {observabilityStats.passes} passes
          </span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Zoom slider */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[0.72rem] font-medium text-[var(--text-3)]">Zoom</span>
        <input
          className="h-1 w-20 cursor-pointer accent-[var(--accent)]"
          max={2.5} min={0.8} step={0.1} type="range" value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
        />
        <span className="w-7 text-right text-[0.72rem] font-medium tabular-nums text-[var(--text-2)]">{zoom.toFixed(1)}×</span>
      </div>

      {/* Search */}
      <div className="relative w-[min(240px,30vw)] shrink-0">
        <input
          aria-label="Search tasks, events, and bookmarks"
          className="w-full rounded-[9px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 pr-16 text-[0.8rem] text-[var(--text-1)] outline-none transition placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
          onChange={(event) => onSearchQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onSearchQueryChange("");
          }}
          placeholder="Search…"
          type="search"
          value={searchQuery}
        />
        {searchQuery && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-[var(--border)] px-2 py-0.5 text-[0.68rem] font-semibold text-[var(--text-3)] transition hover:text-[var(--text-2)]"
            onClick={() => onSearchQueryChange("")}
            type="button"
          >
            Clear
          </button>
        )}
        {searchQuery.trim() && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-[26rem] overflow-y-auto rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_20px_50px_rgba(15,23,42,0.14)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">
                {isSearching ? "Searching…" : `${totalResults} results`}
              </span>
              {taskScopeEnabled && selectedTaskTitle && (
                <span className="max-w-[14rem] truncate rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-2 py-0.5 text-[0.68rem] font-semibold text-[var(--accent)]">
                  in: {selectedTaskTitle}
                </span>
              )}
            </div>

            {!isSearching && totalResults === 0 && (
              <div className="px-3 py-2 text-[0.73rem] text-[var(--text-3)]">
                No matching tasks, events, or saved cards.
              </div>
            )}

            {(searchResults?.tasks.length ?? 0) > 0 && (
              <div className="border-t border-[var(--border)] first:border-t-0">
                <div className="px-3 py-2 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Tasks</div>
                {searchResults?.tasks.map((task) => (
                  <button
                    key={task.id}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-2)]"
                    onClick={() => onSelectSearchTask(task.taskId)}
                    type="button"
                  >
                    <strong className="text-[0.82rem] font-semibold text-[var(--text-1)]">{task.title}</strong>
                    <span className="text-[0.74rem] text-[var(--text-2)]">{task.workspacePath ?? task.status}</span>
                  </button>
                ))}
              </div>
            )}

            {(searchResults?.events.length ?? 0) > 0 && (
              <div className="border-t border-[var(--border)] first:border-t-0">
                <div className="px-3 py-2 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Cards</div>
                {searchResults?.events.map((event) => (
                  <button
                    key={event.id}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-2)]"
                    onClick={() => onSelectSearchEvent(event.taskId, event.eventId)}
                    type="button"
                  >
                    <strong className="text-[0.82rem] font-semibold text-[var(--text-1)]">{event.title}</strong>
                    <span className="text-[0.74rem] text-[var(--text-2)]">{event.taskTitle} · {event.lane}</span>
                  </button>
                ))}
              </div>
            )}

            {(searchResults?.bookmarks.length ?? 0) > 0 && (
              <div className="border-t border-[var(--border)] first:border-t-0">
                <div className="px-3 py-2 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Saved</div>
                {searchResults?.bookmarks.map((bookmark) => (
                  <button
                    key={bookmark.id}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-2)]"
                    onClick={() => onSelectSearchBookmark(bookmark)}
                    type="button"
                  >
                    <strong className="text-[0.82rem] font-semibold text-[var(--text-1)]">{bookmark.title}</strong>
                    <span className="text-[0.74rem] text-[var(--text-2)]">{bookmark.taskTitle ?? bookmark.kind}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task scope toggle */}
      {selectedTaskTitle && (
        <button
          aria-label={taskScopeEnabled ? "Search all tasks" : "Limit search to this task"}
          className={cn(
            "shrink-0 rounded-[8px] border px-2 py-1.5 text-[0.72rem] font-semibold leading-none transition-all",
            taskScopeEnabled
              ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
              : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          )}
          onClick={() => onTaskScopeToggle(!taskScopeEnabled)}
          type="button"
        >
          This task
        </button>
      )}

      {/* Workflow Library button */}
      <button
        aria-label="Open workflow library"
        className="flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-[0.75rem] font-semibold text-[var(--text-2)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        onClick={onOpenLibrary}
        title="Workflow Library"
        type="button"
      >
        <span className="text-[0.8rem] leading-none">⊞</span>
        Library
      </button>

      {/* Dark mode toggle */}
      <button
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] text-[0.88rem] text-[var(--text-2)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text-1)]"
        onClick={toggleTheme}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
        type="button"
      >
        {theme === "dark" ? "☀" : "☽"}
      </button>

      <Button className="shrink-0 gap-1 rounded-[8px] px-2.5" onClick={onRefresh} size="sm" variant="ghost">
        <img alt="" className="h-3.5 w-3.5 opacity-50" src="/icons/refresh.svg" />
      </Button>

      {/* WS status */}
      <div className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.75rem] font-medium",
        isConnected
          ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
          : "border-[var(--warn-bg)] bg-[var(--warn-bg)] text-[var(--warn)]"
      )}>
        <span
          aria-hidden="true"
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            isConnected
              ? "bg-[var(--ok)]"
              : "bg-[var(--warn)] animate-[blink_1.4s_ease-in-out_infinite]"
          )}
        />
        <span>{isConnected ? "Connected" : "Reconnecting…"}</span>
      </div>

    </header>
  );
}
