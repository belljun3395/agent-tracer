/**
 * 대시보드 상단 통계 바.
 * 총 태스크 수, 실행 중, 대기, 완료, 오류, 이벤트 카운트를 StatCard로 표시.
 */

import type React from "react";
import type {
  BookmarkSearchHit,
  OverviewResponse,
  SearchResponse
} from "../types.js";
import { cn } from "../lib/ui/cn.js";
import { Button } from "./ui/Button.js";

interface TopBarProps {
  readonly overview: OverviewResponse | null;
  readonly isConnected: boolean;
  readonly searchQuery: string;
  readonly searchResults: SearchResponse | null;
  readonly isSearching: boolean;
  readonly selectedTaskTitle?: string | null;
  readonly taskScopeEnabled: boolean;
  readonly onTaskScopeToggle: (enabled: boolean) => void;
  readonly onSearchQueryChange: (value: string) => void;
  readonly onSelectSearchTask: (taskId: string) => void;
  readonly onSelectSearchEvent: (taskId: string, eventId: string) => void;
  readonly onSelectSearchBookmark: (bookmark: BookmarkSearchHit) => void;
  readonly onRefresh: () => void;
}

/**
 * 통계 카드 하나를 렌더링하는 내부 컴포넌트.
 */
function StatCard({
  accent, label, value
}: {
  readonly accent: string;
  readonly label: string;
  readonly value: number;
}): React.JSX.Element {
  const accentClasses = {
    cyan: "text-[#0891b2]",
    green: "text-[var(--ok)]",
    amber: "text-[#b45309]",
    red: "text-[var(--err)]",
    slate: "text-[var(--text-2)]"
  } as const;

  const accentBarClasses = {
    cyan: "bg-[#0891b2]",
    green: "bg-[var(--ok)]",
    amber: "bg-[#b45309]",
    red: "bg-[var(--err)]",
    slate: "bg-[var(--text-3)]"
  } as const;

  return (
    <div className="relative flex min-h-[4.75rem] flex-col justify-between border-r border-[var(--border)]/80 px-3.5 py-3.5 last:border-r-0 sm:px-4">
      <span className="block text-[0.67rem] font-semibold uppercase tracking-[0.09em] text-[var(--text-3)]">
        {label}
      </span>
      <strong className={cn("block text-[1.55rem] font-bold leading-none", accentClasses[accent as keyof typeof accentClasses])}>
        {value}
      </strong>
      <div className={cn("absolute inset-x-0 bottom-0 h-0.5 rounded-b-[1px]", accentBarClasses[accent as keyof typeof accentBarClasses])} />
    </div>
  );
}

/**
 * 대시보드 상단 네비게이션 바와 통계 스트립.
 * 브랜드 로고, WebSocket 연결 상태, 태스크/이벤트 통계를 표시.
 */
export function TopBar({
  overview,
  isConnected,
  searchQuery,
  searchResults,
  isSearching,
  selectedTaskTitle,
  taskScopeEnabled,
  onTaskScopeToggle,
  onSearchQueryChange,
  onSelectSearchTask,
  onSelectSearchEvent,
  onSelectSearchBookmark,
  onRefresh
}: TopBarProps): React.JSX.Element {
  const totalResults = (searchResults?.tasks.length ?? 0)
    + (searchResults?.events.length ?? 0)
    + (searchResults?.bookmarks.length ?? 0);

  return (
    <>
      <nav className="z-10 flex h-[56px] shrink-0 items-center justify-between border-b border-[var(--border)] bg-[linear-gradient(180deg,var(--surface)_0%,var(--surface-2)_100%)] px-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] backdrop-blur-[8px] sm:px-5 max-[900px]:h-auto max-[900px]:flex-col max-[900px]:items-stretch max-[900px]:gap-3 max-[900px]:py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
            <img
              alt=""
              className="h-[18px] w-[18px] [filter:brightness(0)_saturate(100%)_invert(36%)_sepia(89%)_saturate(451%)_hue-rotate(143deg)_brightness(93%)]"
              src="/icons/activity.svg"
            />
          </span>
          <span className="text-base font-bold tracking-[-0.025em] text-[var(--text-1)]">Monitor</span>
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3 max-[900px]:w-full max-[900px]:flex-wrap max-[900px]:justify-between max-[900px]:gap-2">
          <div className="relative w-[min(36rem,42vw)] min-w-[18rem] max-[900px]:w-full max-[900px]:min-w-0 max-[900px]:flex-[1_1_100%]">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <input
                  aria-label="Search tasks, events, and bookmarks"
                  className="w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 pr-20 text-[var(--text-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] outline-none transition placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] max-[900px]:pr-18"
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") onSearchQueryChange("");
                  }}
                  placeholder="Search tasks, cards, MCP calls, skills…"
                  type="search"
                  value={searchQuery}
                />
                {searchQuery && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-transparent bg-[var(--surface-2)] px-2.5 py-1 text-[0.72rem] font-semibold text-[var(--text-3)] transition hover:border-[var(--border)] hover:text-[var(--text-2)]"
                    onClick={() => onSearchQueryChange("")}
                    type="button"
                  >
                    Clear
                  </button>
                )}
              </div>
              {selectedTaskTitle && (
                <button
                  aria-label={taskScopeEnabled ? "Search all tasks" : "Limit search to this task"}
                  className={cn(
                    "shrink-0 rounded-[10px] border px-2.5 py-2 text-[0.72rem] font-semibold leading-none transition-all",
                    taskScopeEnabled
                      ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  )}
                  onClick={() => onTaskScopeToggle(!taskScopeEnabled)}
                  title={taskScopeEnabled ? `Searching in: ${selectedTaskTitle}` : `Limit to: ${selectedTaskTitle}`}
                  type="button"
                >
                  This task
                </button>
              )}
            </div>
            {searchQuery.trim() && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-[26rem] overflow-y-auto rounded-[14px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_20px_50px_rgba(15,23,42,0.14)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2.5">
                  <span className="text-[0.73rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">
                    {isSearching ? "Searching…" : `${totalResults} results`}
                  </span>
                  {taskScopeEnabled && selectedTaskTitle && (
                    <span className="max-w-[14rem] truncate rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-2 py-0.5 text-[0.68rem] font-semibold text-[var(--accent)]">
                      in: {selectedTaskTitle}
                    </span>
                  )}
                </div>

                {!isSearching && totalResults === 0 && (
                  <div className="px-3 py-2.5 text-[0.73rem] text-[var(--text-3)]">
                    No matching tasks, events, or saved cards.
                  </div>
                )}

                {(searchResults?.tasks.length ?? 0) > 0 && (
                  <div className="border-t border-[var(--border)] first:border-t-0">
                    <div className="px-3 py-2.5 text-[0.73rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Tasks</div>
                    {searchResults?.tasks.map((task) => (
                      <button
                        key={task.id}
                        className="flex w-full flex-col items-start gap-1 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
                        onClick={() => onSelectSearchTask(task.taskId)}
                        type="button"
                      >
                        <strong className="text-[0.84rem] font-semibold text-[var(--text-1)]">{task.title}</strong>
                        <span className="text-[0.76rem] text-[var(--text-2)]">{task.workspacePath ?? task.status}</span>
                      </button>
                    ))}
                  </div>
                )}

                {(searchResults?.events.length ?? 0) > 0 && (
                  <div className="border-t border-[var(--border)] first:border-t-0">
                    <div className="px-3 py-2.5 text-[0.73rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Cards</div>
                    {searchResults?.events.map((event) => (
                      <button
                        key={event.id}
                        className="flex w-full flex-col items-start gap-1 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
                        onClick={() => onSelectSearchEvent(event.taskId, event.eventId)}
                        type="button"
                      >
                        <strong className="text-[0.84rem] font-semibold text-[var(--text-1)]">{event.title}</strong>
                        <span className="text-[0.76rem] text-[var(--text-2)]">{event.taskTitle} · {event.lane}</span>
                      </button>
                    ))}
                  </div>
                )}

                {(searchResults?.bookmarks.length ?? 0) > 0 && (
                  <div className="border-t border-[var(--border)] first:border-t-0">
                    <div className="px-3 py-2.5 text-[0.73rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Saved</div>
                    {searchResults?.bookmarks.map((bookmark) => (
                      <button
                        key={bookmark.id}
                        className="flex w-full flex-col items-start gap-1 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
                        onClick={() => onSelectSearchBookmark(bookmark)}
                        type="button"
                      >
                        <strong className="text-[0.84rem] font-semibold text-[var(--text-1)]">{bookmark.title}</strong>
                        <span className="text-[0.76rem] text-[var(--text-2)]">{bookmark.taskTitle ?? bookmark.kind}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <Button className="gap-1.5 rounded-[10px] px-3" onClick={onRefresh} size="sm" variant="ghost">
            <img alt="" className="h-3.5 w-3.5 opacity-60" src="/icons/refresh.svg" />
            Refresh
          </Button>
          <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[0.8rem] font-medium text-[var(--text-3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                isConnected
                  ? "bg-[var(--ok)] shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
                  : "bg-[#f59e0b] animate-[blink_1.4s_ease-in-out_infinite]"
              )}
            />
            <span>{isConnected ? "Connected" : "Reconnecting…"}</span>
          </div>
        </div>
      </nav>
      <div className="grid grid-cols-2 border-b border-[var(--border)] bg-[linear-gradient(180deg,var(--surface-2)_0%,var(--surface)_100%)] sm:grid-cols-3 lg:grid-cols-6">
        <StatCard accent="cyan" label="Tasks" value={overview?.stats.totalTasks ?? 0} />
        <StatCard accent="green" label="Running" value={overview?.stats.runningTasks ?? 0} />
        <StatCard accent="amber" label="Waiting" value={overview?.stats.waitingTasks ?? 0} />
        <StatCard accent="amber" label="Completed" value={overview?.stats.completedTasks ?? 0} />
        <StatCard accent="red" label="Errored" value={overview?.stats.erroredTasks ?? 0} />
        <StatCard accent="slate" label="Events" value={overview?.stats.totalEvents ?? 0} />
      </div>
    </>
  );
}
