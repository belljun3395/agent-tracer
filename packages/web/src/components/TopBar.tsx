/**
 * 대시보드 상단 통계 바.
 * 총 태스크 수, 실행 중, 완료, 오류, 이벤트 카운트를 StatCard로 표시.
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
    amber: "text-[var(--rules)]",
    red: "text-[var(--err)]",
    slate: "text-[var(--text-2)]"
  } as const;

  const accentBarClasses = {
    cyan: "bg-[#0891b2]",
    green: "bg-[var(--ok)]",
    amber: "bg-[var(--rules)]",
    red: "bg-[var(--err)]",
    slate: "bg-[var(--text-3)]"
  } as const;

  return (
    <div className="relative border-r border-[var(--border)] px-3.5 py-3.5 last:border-r-0">
      <span className="mb-1.5 block text-[0.67rem] font-semibold uppercase tracking-[0.09em] text-[var(--text-3)]">
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
      <nav className="z-10 flex h-[50px] shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-2.5">
          <img
            alt=""
            className="h-5 w-5 [filter:brightness(0)_saturate(100%)_invert(36%)_sepia(89%)_saturate(451%)_hue-rotate(143deg)_brightness(93%)]"
            src="/icons/activity.svg"
          />
          <span className="text-base font-bold tracking-[-0.025em] text-[var(--text-1)]">Monitor</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-[min(32rem,40vw)]">
            <input
              aria-label="Search tasks, events, and bookmarks"
              className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-[9px] pr-20 text-[var(--text-1)] outline-none transition placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search tasks, cards, MCP calls, skills…"
              type="search"
              value={searchQuery}
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[0.72rem] font-semibold text-[var(--text-3)] transition hover:text-[var(--text-2)]"
                onClick={() => onSearchQueryChange("")}
                type="button"
              >
                Clear
              </button>
            )}
            {searchQuery.trim() && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-[26rem] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                <div className="border-b border-[var(--border)] px-3 py-2.5 text-[0.73rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">
                  <span>{isSearching ? "Searching…" : `${totalResults} results`}</span>
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
          <Button className="gap-1.5 px-3" onClick={onRefresh} size="sm" variant="ghost">
            <img alt="" className="h-3.5 w-3.5 opacity-60" src="/icons/refresh.svg" />
            Refresh
          </Button>
          <div className="flex items-center gap-1.5 text-[0.8rem] font-medium text-[var(--text-3)]">
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
      <div className="grid grid-cols-2 border-b border-[var(--border)] sm:grid-cols-3 lg:grid-cols-5">
        <StatCard accent="cyan" label="Tasks" value={overview?.stats.totalTasks ?? 0} />
        <StatCard accent="green" label="Running" value={overview?.stats.runningTasks ?? 0} />
        <StatCard accent="amber" label="Completed" value={overview?.stats.completedTasks ?? 0} />
        <StatCard accent="red" label="Errored" value={overview?.stats.erroredTasks ?? 0} />
        <StatCard accent="slate" label="Events" value={overview?.stats.totalEvents ?? 0} />
      </div>
    </>
  );
}
