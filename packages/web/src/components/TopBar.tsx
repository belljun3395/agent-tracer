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
import { formatCount, formatDuration, formatRate } from "../lib/observability.js";

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
  accent, label, value, detail, compact = false
}: {
  readonly accent: string;
  readonly label: string;
  readonly value: React.ReactNode;
  readonly detail?: string | undefined;
  readonly compact?: boolean;
}): React.JSX.Element {
  return (
    <div className={`stat-card ${accent}${compact ? " compact" : ""}`}>
      <span className="stat-card-label">{label}</span>
      <strong className="stat-card-value">{value}</strong>
      {detail && <span className="stat-card-detail">{detail}</span>}
      <div className="stat-card-bar" />
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
  const observability = overview?.observability ?? null;

  return (
    <>
      <nav className="topnav">
        <div className="topnav-brand">
          <img className="brand-icon" src="/icons/activity.svg" alt="" />
          <span className="brand-name">Monitor</span>
        </div>
        <div className="topnav-right">
          <div className={`topnav-search${searchQuery.trim() ? " has-results" : ""}`}>
            <input
              aria-label="Search tasks, events, and bookmarks"
              className="topnav-search-input"
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search tasks, cards, MCP calls, skills…"
              type="search"
              value={searchQuery}
            />
            {searchQuery && (
              <button
                className="topnav-search-clear"
                onClick={() => onSearchQueryChange("")}
                type="button"
              >
                Clear
              </button>
            )}
            {searchQuery.trim() && (
              <div className="topnav-search-results">
                <div className="search-results-head">
                  <span>{isSearching ? "Searching…" : `${totalResults} results`}</span>
                </div>

                {!isSearching && totalResults === 0 && (
                  <div className="search-empty">No matching tasks, events, or saved cards.</div>
                )}

                {(searchResults?.tasks.length ?? 0) > 0 && (
                  <div className="search-group">
                    <div className="search-group-title">Tasks</div>
                    {searchResults?.tasks.map((task) => (
                      <button
                        key={task.id}
                        className="search-result-row"
                        onClick={() => onSelectSearchTask(task.taskId)}
                        type="button"
                      >
                        <strong>{task.title}</strong>
                        <span>{task.workspacePath ?? task.status}</span>
                      </button>
                    ))}
                  </div>
                )}

                {(searchResults?.events.length ?? 0) > 0 && (
                  <div className="search-group">
                    <div className="search-group-title">Cards</div>
                    {searchResults?.events.map((event) => (
                      <button
                        key={event.id}
                        className="search-result-row"
                        onClick={() => onSelectSearchEvent(event.taskId, event.eventId)}
                        type="button"
                      >
                        <strong>{event.title}</strong>
                        <span>{event.taskTitle} · {event.lane}</span>
                      </button>
                    ))}
                  </div>
                )}

                {(searchResults?.bookmarks.length ?? 0) > 0 && (
                  <div className="search-group">
                    <div className="search-group-title">Saved</div>
                    {searchResults?.bookmarks.map((bookmark) => (
                      <button
                        key={bookmark.id}
                        className="search-result-row"
                        onClick={() => onSelectSearchBookmark(bookmark)}
                        type="button"
                      >
                        <strong>{bookmark.title}</strong>
                        <span>{bookmark.taskTitle ?? bookmark.kind}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button className="ghost-button" onClick={onRefresh} type="button">
            <img src="/icons/refresh.svg" alt="" />
            Refresh
          </button>
          <div className="topnav-status">
            <span className={`status-dot ${isConnected ? "connected" : "disconnected"}`} />
            <span>{isConnected ? "Connected" : "Reconnecting…"}</span>
          </div>
        </div>
      </nav>
      <div className="stats-strip">
        <StatCard label="Tasks" value={overview?.stats.totalTasks ?? 0} accent="cyan" />
        <StatCard label="Running" value={overview?.stats.runningTasks ?? 0} accent="green" />
        <StatCard label="Completed" value={overview?.stats.completedTasks ?? 0} accent="amber" />
        <StatCard label="Errored" value={overview?.stats.erroredTasks ?? 0} accent="red" />
        <StatCard label="Events" value={overview?.stats.totalEvents ?? 0} accent="slate" />
        <StatCard
          compact
          label="Prompt Capture"
          value={observability ? formatRate(observability.promptCaptureRate) : "—"}
          accent="cyan"
          detail="raw prompts"
        />
        <StatCard
          compact
          label="Flow Coverage"
          value={observability ? formatRate(observability.explicitFlowCoverageRate) : "—"}
          accent="green"
          detail="explicit relations"
        />
        <StatCard
          compact
          label="Stale Running"
          value={observability ? formatCount(observability.staleRunningTasks) : "—"}
          accent="red"
          detail="needs attention"
        />
        <StatCard
          compact
          label="Avg Duration"
          value={observability ? formatDuration(observability.avgDurationMs) : "—"}
          accent="slate"
          detail="per task"
        />
      </div>
      {observability?.runtimeSources && observability.runtimeSources.length > 0 && (
        <div className="topbar-runtime-sources" aria-label="Runtime source health">
          {observability.runtimeSources.map((source) => (
            <span key={source.runtimeSource} className="runtime-source-chip">
              <strong>{source.runtimeSource}</strong>
              <span>{formatCount(source.taskCount)} tasks</span>
              <span>{formatRate(source.promptCaptureRate)} capture</span>
              <span>{formatRate(source.explicitFlowCoverageRate)} flow</span>
              <span>{formatCount(source.runningTaskCount)} running</span>
            </span>
          ))}
          <span className="runtime-source-chip muted">
            Snapshot {observability.generatedAt ? new Date(observability.generatedAt).toLocaleTimeString() : "n/a"}
          </span>
        </div>
      )}
    </>
  );
}
