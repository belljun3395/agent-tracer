import type React from "react";
import type { BookmarkRecord, MonitoringTask, TaskDetailResponse } from "../../types.js";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/ui/cn.js";
import { TaskList } from "./TaskList.js";

interface NavigationSidebarProps {
  readonly className?: string;
  readonly isConnected: boolean;
  readonly activeView: "tasks" | "saved";
  readonly onNavigate?: () => void;
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
  readonly onDeleteTask: (taskId: string) => void;
}

function SidebarLink({ active, to, onClick, icon, label }: {
  readonly active: boolean;
  readonly to: string;
  readonly onClick?: () => void;
  readonly icon: React.ReactNode;
  readonly label: string;
}): React.JSX.Element {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-1.5 text-[0.78rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
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
  const { className, isConnected, activeView, onChangeView, onNavigate, ...taskListProps } = props;

  const { pathname } = useLocation();
  const isKnowledgePage = pathname.startsWith("/knowledge");

  return (
    <nav
      aria-label="Main navigation"
      className={cn("flex h-full w-[240px] shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,var(--bg))] shadow-[var(--shadow-1)]", className)}
    >
      {/* Navigation items */}
      <div className="flex shrink-0 flex-col gap-0.5 px-2 py-1.5">
        <SidebarLink
          to="/"
          active={!isKnowledgePage && activeView === "tasks"}
          onClick={() => {
            onChangeView("tasks");
            onNavigate?.();
          }}
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
        <SidebarLink
          to="/"
          active={!isKnowledgePage && activeView === "saved"}
          onClick={() => {
            onChangeView("saved");
            onNavigate?.();
          }}
          icon={
            <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          }
          label="Saved"
        />
        <SidebarLink
          to="/knowledge"
          active={isKnowledgePage}
          onClick={() => onNavigate?.()}
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
      <div className="mx-3 shrink-0 border-b border-[var(--border)]" />

      {/* Task/Saved list */}
      {!isKnowledgePage && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TaskList
            {...taskListProps}
            hideHeader={true}
            hideTabs={true}
            isCollapsed={false}
            initialView={activeView}
            onToggleCollapse={() => { /* no-op, header hidden */ }}
          />
        </div>
      )}
      {isKnowledgePage && (
        <div className="flex-1" />
      )}

      {/* Connection status footer */}
      <div className="flex shrink-0 items-center gap-2 border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5">
        <span
          aria-label={isConnected ? "Connected" : "Reconnecting"}
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            isConnected ? "bg-[var(--ok)]" : "animate-pulse bg-[var(--warn)]"
          )}
        />
        <span className="text-[0.68rem] text-[var(--text-3)]">
          {isConnected ? "Connected" : "Reconnecting…"}
        </span>
      </div>
    </nav>
  );
}
