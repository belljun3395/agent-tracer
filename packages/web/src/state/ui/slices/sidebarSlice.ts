import type { TaskId } from "~domain/monitoring.js";

export type SidebarFilter = "all" | "live" | "attn" | "done";
export type SearchScope = "all" | "this-task";

export interface SidebarSlice {
  readonly filter: SidebarFilter;
  /** Free-text task title query — transient, not persisted. */
  readonly searchQuery: string;
  /**
   * "all"        — search across every task and event in the workspace
   * "this-task"  — limit results to the currently selected task only
   *
   * Persisted across reloads (modest user preference; the UI stores
   * filter pills the same way).
   */
  readonly searchScope: SearchScope;
  /**
   * Per-task "last seen" timestamp (ms). Compared against the task's most
   * recent event timestamp to render the unread pulse + "+N events" badge.
   * Persisted across reloads — that's how a returning user knows what's new.
   */
  readonly lastSeenAt: Readonly<Record<string, number>>;
  /**
   * Parent task ids whose subagent children are currently collapsed in
   * the sidebar tree. Persisted so the user's exploration state survives
   * a reload of the dashboard.
   */
  readonly collapsedParents: readonly string[];
  readonly setFilter: (filter: SidebarFilter) => void;
  readonly setSearchQuery: (query: string) => void;
  readonly setSearchScope: (scope: SearchScope) => void;
  readonly markTaskRead: (taskId: TaskId, atMs?: number) => void;
  readonly toggleCollapsedParent: (taskId: TaskId) => void;
}

type SetState = (
  partial:
    | Partial<SidebarSlice>
    | ((state: SidebarSlice) => Partial<SidebarSlice>),
) => void;

export function createSidebarSlice(set: SetState): SidebarSlice {
  return {
    filter: "all",
    searchQuery: "",
    searchScope: "all",
    lastSeenAt: {},
    collapsedParents: [],
    setFilter: (filter) => set({ filter }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setSearchScope: (searchScope) => set({ searchScope }),
    markTaskRead: (taskId, atMs) =>
      set((state) => ({
        lastSeenAt: {
          ...state.lastSeenAt,
          [taskId]: atMs ?? Date.now(),
        },
      })),
    toggleCollapsedParent: (taskId) =>
      set((state) => {
        const existing = new Set(state.collapsedParents);
        if (existing.has(taskId)) existing.delete(taskId);
        else existing.add(taskId);
        return { collapsedParents: Array.from(existing) };
      }),
  };
}
