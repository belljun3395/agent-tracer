import type React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/ui/cn.js";
import { TaskList } from "./TaskList.js";
import type { BookmarkRecord, MonitoringTask, TaskDetailResponse } from "@monitor/web-core";

interface NavigationSidebarProps {
  readonly isConnected: boolean;
  readonly activeView: "tasks" | "saved";
  readonly onChangeView: (view: "tasks" | "saved") => void;
  readonly tasks: readonly MonitoringTask[];
  readonly bookmarks: readonly BookmarkRecord[];
  readonly taskDisplayTitleCache?: Readonly<Record<string, { readonly title: string; readonly updatedAt: string }>>;
  readonly selectedTaskBookmarkId: string | null;
  readonly selectedTaskId: string | null;
  readonly taskDetail: TaskDetailResponse | null;
  readonly selectedTaskQuestionCount?: number;
  readonly selectedTaskTodoCount?: number;
  readonly deletingTaskId: string | null;
  readonly deleteErrorTaskId: string | null;
  readonly onSelectTask: (taskId: string) => void;
  readonly onSelectBookmark: (bookmark: BookmarkRecord) => void;
  readonly onDeleteBookmark: (bookmarkId: string) => void;
  readonly onSaveTaskBookmark: () => void;
  readonly onDeleteTask: (taskId: string) => void;
  readonly onRefresh: () => void;
}

function NavItem({ active, onClick, icon, label }: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly icon: React.ReactNode;
  readonly label: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-[0.82rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
        active
          ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]"
          : "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function NavLinkItem({ to, icon, label }: {
  readonly to: string;
  readonly icon: React.ReactNode;
  readonly label: string;
}): React.JSX.Element {
  const { pathname } = useLocation();
  const active = pathname === to || pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-[0.82rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
        active
          ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]"
          : "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export function NavigationSidebar(props: NavigationSidebarProps): React.JSX.Element {
  const { isConnected, activeView, onChangeView, ...taskListProps } = props;

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-full w-[240px] shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)]"
    >
      {/* Brand header */}
      <div className="flex h-10 shrink-0 items-center gap-2.5 border-b border-[var(--border)] px-3">
        <img
          alt="Agent Tracer"
          className="icon-adaptive h-5 w-5 opacity-70"
          src="/icons/activity.svg"
        />
        <span className="text-[0.72rem] font-semibold tracking-[0.02em] text-[var(--text-2)]">
          Agent Tracer
        </span>
      </div>

      {/* Navigation items */}
      <div className="flex shrink-0 flex-col gap-0.5 px-2 py-2">
        <NavItem
          active={activeView === "tasks"}
          onClick={() => onChangeView("tasks")}
          icon={
            <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
              <rect height="18" rx="2" width="18" x="3" y="3"/>
              <line x1="9" x2="15" y1="9" y2="9"/>
              <line x1="9" x2="15" y1="12" y2="12"/>
              <line x1="9" x2="13" y1="15" y2="15"/>
            </svg>
          }
          label="Tasks"
        />
        <NavItem
          active={activeView === "saved"}
          onClick={() => onChangeView("saved")}
          icon={
            <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          }
          label="Saved"
        />
        <NavLinkItem
          to="/knowledge"
          icon={
            <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
              <rect height="7" rx="1" width="7" x="3" y="3"/>
              <rect height="7" rx="1" width="7" x="14" y="3"/>
              <rect height="7" rx="1" width="7" x="3" y="14"/>
              <rect height="7" rx="1" width="7" x="14" y="14"/>
            </svg>
          }
          label="Knowledge Base"
        />
      </div>

      {/* Divider */}
      <div className="mx-2 shrink-0 border-b border-[var(--border)]" />

      {/* Task/Saved list */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TaskList
          {...taskListProps}
          hideHeader={true}
          isCollapsed={false}
          initialView={activeView}
          onToggleCollapse={() => { /* no-op, header hidden */ }}
        />
      </div>

      {/* Connection status footer */}
      <div className="flex shrink-0 items-center gap-2 border-t border-[var(--border)] px-3 py-2">
        <span
          aria-label={isConnected ? "Connected" : "Reconnecting"}
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            isConnected ? "bg-[var(--ok)]" : "animate-pulse bg-[var(--warn)]"
          )}
        />
        <span className="text-[0.72rem] text-[var(--text-3)]">
          {isConnected ? "Connected" : "Reconnecting…"}
        </span>
      </div>
    </nav>
  );
}
