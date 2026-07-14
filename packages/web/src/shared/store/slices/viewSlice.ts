export type MainView = "feed" | "graph";
export type InspectorTab = "inspect" | "rules" | "trace";

/** 사용자가 화면에 유지하기로 고른 시각 레인. */
export type VisibleLane =
  | "user"
  | "asst"
  | "plan"
  | "expl"
  | "impl"
  | "rule"
  | "veri"
  | "coord";

export const ALL_VISIBLE_LANES: readonly VisibleLane[] = [
  "user",
  "asst",
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
          // 모든 레인을 숨기는 것은 허용하지 않는다.
          if (state.visibleLanes.length <= 1) return state;
          return {
            visibleLanes: state.visibleLanes.filter((l) => l !== lane),
          };
        }
        // 정해진 순서대로 다시 삽입해, 사용자가 토글할 때 칩 목록의
        // 순서가 예측 불가능하게 바뀌지 않게 한다.
        const next = ALL_VISIBLE_LANES.filter(
          (l) => state.visibleLanes.includes(l) || l === lane,
        );
        return { visibleLanes: next };
      }),
  };
}
