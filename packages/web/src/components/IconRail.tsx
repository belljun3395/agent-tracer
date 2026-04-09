/**
 * 48px 아이콘 레일 — 좌측 수직 네비게이션.
 * Tasks / Saved / Library 플라이아웃을 토글하는 아이콘 버튼 모음.
 */

import type React from "react";
import { cn } from "../lib/ui/cn.js";

export type RailPanel = "tasks" | "saved" | "library" | null;

interface RailBtnProps {
  readonly label: string;
  readonly active: boolean;
  readonly badge?: number | undefined;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}

function RailBtn({ label, active, badge, onClick, children }: RailBtnProps): React.JSX.Element {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1",
        active
          ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]"
          : "text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]"
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[0.55rem] font-bold leading-none text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

interface IconRailProps {
  readonly activePanel: RailPanel;
  readonly taskCount: number;
  readonly savedCount: number;
  readonly isConnected: boolean;
  readonly onTogglePanel: (panel: Exclude<RailPanel, null>) => void;
}

export function IconRail({
  activePanel,
  taskCount,
  savedCount,
  isConnected,
  onTogglePanel
}: IconRailProps): React.JSX.Element {
  return (
    <nav
      aria-label="Navigation rail"
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-[var(--border)] bg-[var(--surface)] px-1 py-2"
    >
      {/* Brand */}
      <div className="mb-2 flex h-8 w-8 shrink-0 items-center justify-center">
        <img
          alt="Agent Tracer"
          className="h-5 w-5 opacity-70"
          src="/icons/activity.svg"
        />
      </div>

      {/* Tasks */}
      <RailBtn
        active={activePanel === "tasks"}
        badge={taskCount}
        label="Tasks"
        onClick={() => onTogglePanel("tasks")}
      >
        <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="18">
          <rect height="18" rx="2" width="18" x="3" y="3" />
          <line x1="9" x2="15" y1="9" y2="9" />
          <line x1="9" x2="15" y1="12" y2="12" />
          <line x1="9" x2="13" y1="15" y2="15" />
        </svg>
      </RailBtn>

      {/* Saved */}
      <RailBtn
        active={activePanel === "saved"}
        badge={savedCount}
        label="Saved"
        onClick={() => onTogglePanel("saved")}
      >
        <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="18">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </RailBtn>

      {/* Library */}
      <RailBtn
        active={activePanel === "library"}
        label="Library"
        onClick={() => onTogglePanel("library")}
      >
        <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="18">
          <rect height="7" rx="1" width="7" x="3" y="3" />
          <rect height="7" rx="1" width="7" x="14" y="3" />
          <rect height="7" rx="1" width="7" x="3" y="14" />
          <rect height="7" rx="1" width="7" x="14" y="14" />
        </svg>
      </RailBtn>

      {/* Spacer */}
      <div className="flex-1" />

      {/* WebSocket status dot */}
      <span
        aria-label={isConnected ? "Connected" : "Reconnecting"}
        className={cn(
          "mb-1 h-2 w-2 rounded-full",
          isConnected
            ? "bg-[var(--ok)]"
            : "animate-pulse bg-[var(--warn)]"
        )}
        title={isConnected ? "Connected" : "Reconnecting…"}
      />
    </nav>
  );
}
