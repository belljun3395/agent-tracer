import type React from "react";
import { useEffect, useRef } from "react";
import type { BookmarkSearchHit, SearchResponse } from "@monitor/web-core";
import { cn } from "../lib/ui/cn.js";
import { useTheme } from "../lib/useTheme.js";
import { Button } from "./ui/Button.js";
interface TopBarProps {
    readonly isConnected: boolean;
    readonly pendingApprovalCount?: number;
    readonly blockedTaskCount?: number;
    readonly isNavigationOpen?: boolean;
    readonly onOpenApprovalQueue?: () => void;
    readonly onToggleNavigation?: () => void;
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
export function TopBar({ isConnected, pendingApprovalCount = 0, blockedTaskCount = 0, isNavigationOpen, onOpenApprovalQueue, onToggleNavigation, searchQuery, searchResults, isSearching, selectedTaskTitle, taskScopeEnabled, onTaskScopeToggle, onSearchQueryChange, onSelectSearchTask, onSelectSearchEvent, onSelectSearchBookmark, onRefresh }: TopBarProps): React.JSX.Element {
    const { theme, toggle: toggleTheme } = useTheme();
    const searchRef = useRef<HTMLInputElement>(null);
    const totalResults = (searchResults?.tasks.length ?? 0)
        + (searchResults?.events.length ?? 0)
        + (searchResults?.bookmarks.length ?? 0);
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent): void => {
            if ((event.metaKey || event.ctrlKey) && event.key === "k") {
                event.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);
    const hasTaskScope = Boolean(selectedTaskTitle);
    const searchPlaceholder = taskScopeEnabled && hasTaskScope
        ? "Search in task… ⌘K"
        : "Search… ⌘K";
    return (<header className="z-10 flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_92%,var(--bg))] px-3 py-2 shadow-[var(--shadow-1)] sm:h-11 sm:flex-nowrap sm:gap-2.5 sm:px-4 sm:py-0">

      
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        {onToggleNavigation && (<button aria-label={isNavigationOpen ? "Close navigation" : "Open navigation"} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-3)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1" onClick={onToggleNavigation} title={isNavigationOpen ? "Close navigation" : "Open navigation"} type="button">
            <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
              {isNavigationOpen ? (<>
                  <path d="M6 6l12 12"/>
                  <path d="M18 6L6 18"/>
                </>) : (<>
                  <path d="M4 7h16"/>
                  <path d="M4 12h16"/>
                  <path d="M4 17h16"/>
                </>)}
            </svg>
          </button>)}
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-1)]">
          <img alt="" className="h-[15px] w-[15px] [filter:brightness(0)_saturate(100%)_invert(27%)_sepia(98%)_saturate(1500%)_hue-rotate(215deg)_brightness(95%)]" src="/icons/activity.svg"/>
        </span>
        <span className="hidden text-[0.8rem] font-semibold tracking-[0.01em] text-[var(--text-2)] xl:inline">
          Agent Tracer
        </span>
      </div>

      
      <div className="relative order-3 basis-full sm:order-none sm:flex-1 sm:basis-auto sm:max-w-[400px]">
        <div className="relative flex items-center">
          
          {hasTaskScope && (<button aria-label={taskScopeEnabled ? "Search all tasks" : "Limit search to this task"} className={cn("absolute left-2 top-1/2 z-[1] flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-[var(--radius-xs)] text-[0.7rem] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]", taskScopeEnabled
                ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]"
                : "text-[var(--text-3)] hover:text-[var(--text-2)]")} onClick={() => onTaskScopeToggle(!taskScopeEnabled)} title={taskScopeEnabled ? `Scoped to: ${selectedTaskTitle}` : "Click to scope search to current task"} type="button">
              <svg aria-hidden="true" fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="12">
                <circle cx="12" cy="12" r="7"/>
                <path d="M12 3v3"/>
                <path d="M12 18v3"/>
                <path d="M3 12h3"/>
                <path d="M18 12h3"/>
              </svg>
            </button>)}
          <input ref={searchRef} aria-label="Search tasks, events, and bookmarks" className={cn("w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] py-2 pr-14 text-[0.8rem] text-[var(--text-1)] outline-none transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1", hasTaskScope ? "pl-8" : "pl-3")} onChange={(event) => onSearchQueryChange(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Escape") {
                onSearchQueryChange("");
                searchRef.current?.blur();
            }
        }} placeholder={searchPlaceholder} type="search" value={searchQuery}/>
          {searchQuery && (<button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[var(--radius-sm)] bg-[var(--surface)] px-2 py-0.5 text-[0.68rem] font-semibold text-[var(--text-3)] shadow-[var(--shadow-1)] transition hover:text-[var(--text-2)]" onClick={() => onSearchQueryChange("")} type="button">
              Clear
            </button>)}
        </div>
        
        {searchQuery.trim() && (<div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-[26rem] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-2)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">
                {isSearching ? "Searching…" : `${totalResults} results`}
              </span>
              {taskScopeEnabled && selectedTaskTitle && (<span className="max-w-[14rem] truncate rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-2 py-0.5 text-[0.68rem] font-semibold text-[var(--accent)]">
                  in: {selectedTaskTitle}
                </span>)}
            </div>

            {!isSearching && totalResults === 0 && (<div className="px-3 py-2 text-[0.73rem] text-[var(--text-3)]">
                No matching tasks, events, or saved cards.
              </div>)}

            {(searchResults?.tasks.length ?? 0) > 0 && (<div className="border-t border-[var(--border)] first:border-t-0">
                <div className="px-3 py-2 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Tasks</div>
                {searchResults?.tasks.map((task) => (<button key={task.id} className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:bg-[var(--surface-2)]" onClick={() => onSelectSearchTask(task.taskId)} type="button">
                    <strong className="text-[0.82rem] font-semibold text-[var(--text-1)]">{task.title}</strong>
                    <span className="text-[0.74rem] text-[var(--text-2)]">{task.workspacePath ?? task.status}</span>
                  </button>))}
              </div>)}

            {(searchResults?.events.length ?? 0) > 0 && (<div className="border-t border-[var(--border)] first:border-t-0">
                <div className="px-3 py-2 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Cards</div>
                {searchResults?.events.map((event) => (<button key={event.id} className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:bg-[var(--surface-2)]" onClick={() => onSelectSearchEvent(event.taskId, event.eventId)} type="button">
                    <strong className="text-[0.82rem] font-semibold text-[var(--text-1)]">{event.title}</strong>
                    <span className="text-[0.74rem] text-[var(--text-2)]">{event.taskTitle} · {event.lane}</span>
                  </button>))}
              </div>)}

            {(searchResults?.bookmarks.length ?? 0) > 0 && (<div className="border-t border-[var(--border)] first:border-t-0">
                <div className="px-3 py-2 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Saved</div>
                {searchResults?.bookmarks.map((bookmark) => (<button key={bookmark.id} className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:bg-[var(--surface-2)]" onClick={() => onSelectSearchBookmark(bookmark)} type="button">
                    <strong className="text-[0.82rem] font-semibold text-[var(--text-1)]">{bookmark.title}</strong>
                    <span className="text-[0.74rem] text-[var(--text-2)]">{bookmark.taskTitle ?? bookmark.kind}</span>
                  </button>))}
              </div>)}
          </div>)}
      </div>

      
      <div className="hidden flex-1 sm:block"/>

      
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {pendingApprovalCount > 0 && (<button className="inline-flex h-7 items-center rounded-[var(--radius-md)] border border-[var(--accent-light)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-2.5 text-[0.72rem] font-semibold text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1" onClick={onOpenApprovalQueue} type="button">
            {pendingApprovalCount} approval
          </button>)}
        {blockedTaskCount > 0 && (<button className="inline-flex h-7 items-center rounded-[var(--radius-md)] border border-[var(--err-bg)] bg-[var(--err-bg)] px-2.5 text-[0.72rem] font-semibold text-[var(--err)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--err)] focus-visible:ring-offset-1" onClick={onOpenApprovalQueue} type="button">
            {blockedTaskCount} blocked
          </button>)}
        <button aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-3)] opacity-60 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text-1)] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1" onClick={toggleTheme} title={theme === "dark" ? "Light mode" : "Dark mode"} type="button">
          {theme === "dark" ? (<svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>) : (<svg aria-hidden="true" fill="currentColor" height="14" viewBox="0 0 24 24" width="14">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>)}
        </button>

        <Button className="shrink-0 gap-1 rounded-[var(--radius-md)] px-2 text-[var(--text-3)]" onClick={onRefresh} size="sm" variant="ghost">
          <img alt="" className="icon-adaptive h-3.5 w-3.5 opacity-50" src="/icons/refresh.svg"/>
        </Button>
      </div>

      
      <span aria-label={isConnected ? "WebSocket connected" : "WebSocket reconnecting"} className={cn("h-2 w-2 shrink-0 rounded-full", isConnected
            ? "bg-[var(--ok)]"
            : "bg-[var(--warn)] animate-[blink_1.4s_ease-in-out_infinite]")} title={isConnected ? "Connected" : "Reconnecting…"}/>

    </header>);
}
