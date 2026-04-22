import type React from "react";
import { useEffect, useRef } from "react";
import type { BookmarkSearchHit, SearchResponse } from "../../types.js";
import { Link } from "react-router-dom";
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
    readonly showFiltersButton?: boolean;
    readonly isFiltersOpen?: boolean;
    readonly filtersButtonRef?: React.RefObject<HTMLButtonElement | null>;
    readonly onToggleFilters?: () => void;
    readonly onToggleRules?: () => void;
    readonly isRulesOpen?: boolean;
}
export function TopBar({ isConnected, pendingApprovalCount = 0, blockedTaskCount = 0, isNavigationOpen, onOpenApprovalQueue, onToggleNavigation, searchQuery, searchResults, isSearching, selectedTaskTitle, taskScopeEnabled, onTaskScopeToggle, onSearchQueryChange, onSelectSearchTask, onSelectSearchEvent, onSelectSearchBookmark, onRefresh, showFiltersButton = false, isFiltersOpen = false, filtersButtonRef, onToggleFilters, onToggleRules, isRulesOpen = false }: TopBarProps): React.JSX.Element {
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
        ? "Search within current task"
        : "Search tasks, events, and saved";
    const scopeToggle = hasTaskScope
        ? (<button aria-label={taskScopeEnabled ? "Search all tasks" : "Limit search to this task"} className={cn("inline-flex h-6 shrink-0 items-center rounded-[var(--radius-sm)] px-1.5 text-[0.62rem] font-semibold transition-[color,background-color] duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]", taskScopeEnabled
                ? "bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]"
                : "text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]")} onClick={() => onTaskScopeToggle(!taskScopeEnabled)} title={taskScopeEnabled ? `Scoped to: ${selectedTaskTitle}` : "Click to scope search to current task"} type="button">
            {taskScopeEnabled ? "Task" : "All"}
          </button>)
        : null;
    return (<header className="z-10 flex h-11 shrink-0 items-center border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_88%,var(--bg))] shadow-none sm:px-0">

      {/* Left: Logo / nav toggle */}
      <div className="flex h-full shrink-0 items-center gap-2 px-3 lg:w-[240px] lg:border-r lg:border-[var(--border)] lg:px-4">
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
        <Link className="flex items-center gap-2 outline-none rounded-[var(--radius-md)] transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]" to="/">
          <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-none">
            <img alt="" className="h-[15px] w-[15px] [filter:brightness(0)_saturate(100%)_invert(27%)_sepia(98%)_saturate(1500%)_hue-rotate(215deg)_brightness(95%)]" src="/icons/activity.svg"/>
          </span>
          <span className="hidden text-[0.78rem] font-semibold tracking-[0.01em] text-[var(--text-2)] xl:inline">
            Agent Tracer
          </span>
        </Link>
      </div>

      {/* Center: Search — takes all remaining space, search pill is capped */}
      <div className="relative flex flex-1 items-center justify-center px-4">
        <div className="relative w-full max-w-[440px]">
          <div className="group flex w-full items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] px-3 py-1.5 shadow-none transition-[border-color,background-color] duration-200 focus-within:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] focus-within:bg-[var(--surface)]">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--text-3)] transition-colors group-focus-within:text-[var(--accent)]">
              <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="13">
                <circle cx="11" cy="11" r="7"/>
                <path d="M20 20l-3.5-3.5"/>
              </svg>
            </span>
            <input
              ref={searchRef}
              aria-label="Search tasks, events, and saved"
              className="min-w-0 flex-1 border-0 bg-transparent text-[0.8rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
              onChange={(event) => onSearchQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  onSearchQueryChange("");
                  searchRef.current?.blur();
                }
              }}
              placeholder={searchPlaceholder}
              type="search"
              value={searchQuery}
            />
            {scopeToggle}
            {!searchQuery && (
              <kbd className="hidden rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[0.6rem] font-semibold text-[var(--text-3)] sm:block">⌘K</kbd>
            )}
            {searchQuery && (
              <button className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]" onClick={() => onSearchQueryChange("")} type="button" aria-label="Clear search">
                <svg fill="none" height="10" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" viewBox="0 0 24 24" width="10"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>

          {searchQuery.trim() && (<div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-[26rem] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-2)]">
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
      </div>

      {/* Right: Actions */}
      <div className="flex h-full shrink-0 items-center gap-1.5 border-l border-[var(--border)] px-3">
        {pendingApprovalCount > 0 && (<button className="inline-flex h-6.5 items-center rounded-[var(--radius-md)] border border-[var(--accent-light)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-2 text-[0.68rem] font-semibold text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1" onClick={onOpenApprovalQueue} type="button">
            {pendingApprovalCount} approval
          </button>)}
        {blockedTaskCount > 0 && (<button className="inline-flex h-6.5 items-center rounded-[var(--radius-md)] border border-[var(--err-bg)] bg-[var(--err-bg)] px-2 text-[0.68rem] font-semibold text-[var(--err)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--err)] focus-visible:ring-offset-1" onClick={onOpenApprovalQueue} type="button">
            {blockedTaskCount} blocked
          </button>)}
        {showFiltersButton && onToggleFilters && (
          <button ref={filtersButtonRef} aria-expanded={isFiltersOpen} aria-label="Open filters and zoom" className={cn("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 text-[0.72rem] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1", isFiltersOpen
              ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
              : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-3)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text-1)]")} onClick={onToggleFilters} title="Filters & Zoom" type="button">
            <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
              <line x1="4" x2="20" y1="6" y2="6"/><line x1="8" x2="16" y1="12" y2="12"/><line x1="11" x2="13" y1="18" y2="18"/>
            </svg>
            <span className="hidden sm:inline">Filters</span>
          </button>
        )}
        {onToggleRules && (
          <button
            aria-label="Rule commands"
            className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1",
              isRulesOpen
                ? "border-[var(--rule)] bg-[var(--rule-bg)] text-[var(--rule)]"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-3)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text-1)]"
            )}
            onClick={onToggleRules}
            title="Rule Commands"
            type="button"
          >
            <img alt="" className="icon-adaptive h-3.5 w-3.5" src="/icons/shield-check.svg" />
          </button>
        )}
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
        <span aria-label={isConnected ? "WebSocket connected" : "WebSocket reconnecting"} className={cn("h-2 w-2 shrink-0 rounded-full", isConnected
              ? "bg-[var(--ok)]"
              : "bg-[var(--warn)] animate-[blink_1.4s_ease-in-out_infinite]")} title={isConnected ? "Connected" : "Reconnecting…"}/>
      </div>

    </header>);
}
