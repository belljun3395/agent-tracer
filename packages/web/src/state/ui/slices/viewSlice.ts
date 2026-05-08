export type MainView = "feed" | "graph" | "overview";
export type InspectorTab = "inspect" | "rules" | "trace";

/**
 * Visual lanes the user has chosen to keep on screen. The order
 * mirrors `GRAPH_LANE_KEYS`; `bg` is intentionally absent because it
 * is filtered out earlier in the graph layout pipeline.
 *
 * Persisted across reloads — the user's pruned view-of-the-world is a
 * preference, not transient state.
 */
export type VisibleLane =
  | "user"
  | "plan"
  | "expl"
  | "impl"
  | "rule"
  | "veri"
  | "coord";

export const ALL_VISIBLE_LANES: readonly VisibleLane[] = [
  "user",
  "plan",
  "expl",
  "impl",
  "rule",
  "veri",
  "coord",
];

export interface ViewSlice {
  readonly mainView: MainView;
  readonly inspectorTab: InspectorTab;
  readonly visibleLanes: readonly VisibleLane[];
  readonly setMainView: (view: MainView) => void;
  readonly setInspectorTab: (tab: InspectorTab) => void;
  readonly toggleVisibleLane: (lane: VisibleLane) => void;
  readonly setVisibleLanes: (lanes: readonly VisibleLane[]) => void;
}

type SetState = (
  partial: Partial<ViewSlice> | ((state: ViewSlice) => Partial<ViewSlice>),
) => void;

export function createViewSlice(set: SetState): ViewSlice {
  return {
    mainView: "feed",
    inspectorTab: "inspect",
    visibleLanes: ALL_VISIBLE_LANES,
    setMainView: (mainView) => set({ mainView }),
    setInspectorTab: (inspectorTab) => set({ inspectorTab }),
    setVisibleLanes: (visibleLanes) => set({ visibleLanes }),
    toggleVisibleLane: (lane) =>
      set((state) => {
        const has = state.visibleLanes.includes(lane);
        if (has) {
          // Don't allow hiding every lane — leaves the canvas blank
          // with no recovery path other than digging through settings.
          if (state.visibleLanes.length <= 1) return state;
          return {
            visibleLanes: state.visibleLanes.filter((l) => l !== lane),
          };
        }
        // Re-insert in the canonical order so the chip strip never
        // reorders unpredictably as the user toggles.
        const next = ALL_VISIBLE_LANES.filter(
          (l) => state.visibleLanes.includes(l) || l === lane,
        );
        return { visibleLanes: next };
      }),
  };
}
