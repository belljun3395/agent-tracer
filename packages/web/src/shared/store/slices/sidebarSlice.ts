import type { TaskId } from "~web/shared/identity.js";

// 필터 필·카운트·판정이 모두 이 목록에서 파생된다.
export const SIDEBAR_FILTERS = ["all", "live", "attn", "done"] as const;
export type SidebarFilter = (typeof SIDEBAR_FILTERS)[number];
export type SearchScope = "all" | "this-task";
/** 검색 결과에서 태스크 히트만 볼지 이벤트 히트만 볼지 고르며 searchScope와는 독립이다. */
export type SearchType = "tasks" | "events";
/**
 * 태스크 목록의 최상위 구분.
 *   - "tasks"     : 사용자가 시작한 런타임 세션(기본값)
 *   - "subagents" : 서버가 시작한 Claude Agent SDK 잡(title suggestion,
 *                   task cleanup, recipe scan, rule generation).
 *                   Origin === "server-sdk".
 */
export type SidebarView = "tasks" | "subagents";

export interface SidebarSlice {
  readonly view: SidebarView;
  readonly filter: SidebarFilter;
  /** 자유 텍스트 태스크 제목 검색어. */
  readonly searchQuery: string;
  /**
   * "all"        : 워크스페이스의 모든 태스크·이벤트를 검색한다
   * "this-task"  : 현재 선택된 태스크로만 결과를 제한한다
   *
   * 새로고침 후에도 유지된다(가벼운 사용자 선호이며, UI는 필터 pill도
   * 같은 방식으로 저장한다).
   */
  readonly searchScope: SearchScope;
  /** 검색 결과에서 보여줄 히트 종류이며 새로고침 후에도 유지되고 기본값은 "tasks"다. */
  readonly searchType: SearchType;
  /** 태스크별 "마지막으로 본" 시각(ms). 태스크의 가장 최근 이벤트 시각과 비교해 unread pulse와 "+N events" 배지를 렌더링한다. */
  readonly lastSeenAt: Readonly<Record<string, number>>;
  /** 사이드바 트리에서 서브에이전트 자식이 현재 접혀 있는 부모 태스크 id 목록. */
  readonly collapsedParents: readonly string[];
  /** true면 사이드바가 active 대신 archived 태스크를 가져온다. */
  readonly showArchived: boolean;
  readonly setView: (view: SidebarView) => void;
  readonly setFilter: (filter: SidebarFilter) => void;
  readonly setSearchQuery: (query: string) => void;
  readonly setSearchScope: (scope: SearchScope) => void;
  readonly setSearchType: (type: SearchType) => void;
  readonly markTaskRead: (taskId: TaskId, atMs?: number) => void;
  readonly toggleCollapsedParent: (taskId: TaskId) => void;
  readonly setShowArchived: (value: boolean) => void;
}

type SetState = (
  partial:
    | Partial<SidebarSlice>
    | ((state: SidebarSlice) => Partial<SidebarSlice>),
) => void;

export function createSidebarSlice(set: SetState): SidebarSlice {
  return {
    view: "tasks",
    filter: "all",
    searchQuery: "",
    searchScope: "all",
    searchType: "tasks",
    lastSeenAt: {},
    collapsedParents: [],
    showArchived: false,
    setView: (view) => set({ view }),
    setFilter: (filter) => set({ filter }),
    setShowArchived: (value) => set({ showArchived: value }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setSearchScope: (searchScope) => set({ searchScope }),
    setSearchType: (searchType) => set({ searchType }),
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
