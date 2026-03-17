/**
 * 대시보드 상단 통계 바.
 * 총 태스크 수, 실행 중, 완료, 오류, 이벤트 카운트를 StatCard로 표시.
 */

import type { OverviewResponse } from "../types.js";

interface TopBarProps {
  readonly overview: OverviewResponse | null;
  readonly isConnected: boolean;
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
}): JSX.Element {
  return (
    <div className={`stat-card ${accent}`}>
      <span className="stat-card-label">{label}</span>
      <strong className="stat-card-value">{value}</strong>
      <div className="stat-card-bar" />
    </div>
  );
}

/**
 * 대시보드 상단 네비게이션 바와 통계 스트립.
 * 브랜드 로고, WebSocket 연결 상태, 태스크/이벤트 통계를 표시.
 */
export function TopBar({ overview, isConnected, onRefresh }: TopBarProps): JSX.Element {
  return (
    <>
      <nav className="topnav">
        <div className="topnav-brand">
          <img className="brand-icon" src="/icons/activity.svg" alt="" />
          <span className="brand-name">Monitor</span>
        </div>
        <div className="topnav-status">
          <span className={`status-dot ${isConnected ? "connected" : "disconnected"}`} />
          <span>{isConnected ? "Connected" : "Reconnecting…"}</span>
        </div>
      </nav>
      <div className="stats-strip">
        <StatCard label="Tasks"     value={overview?.stats.totalTasks     ?? 0} accent="cyan"  />
        <StatCard label="Running"   value={overview?.stats.runningTasks   ?? 0} accent="green" />
        <StatCard label="Completed" value={overview?.stats.completedTasks ?? 0} accent="amber" />
        <StatCard label="Errored"   value={overview?.stats.erroredTasks   ?? 0} accent="red"   />
        <StatCard label="Events"    value={overview?.stats.totalEvents    ?? 0} accent="slate" />
        <button
          className="ghost-button"
          onClick={onRefresh}
          type="button"
          style={{ marginLeft: "auto" }}
        >
          <img src="/icons/refresh.svg" alt="" />
          Refresh
        </button>
      </div>
    </>
  );
}
