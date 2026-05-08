export type MainView = "feed" | "graph" | "overview";
export type InspectorTab = "inspect" | "rules" | "trace";

export interface ViewSlice {
  readonly mainView: MainView;
  readonly inspectorTab: InspectorTab;
  readonly setMainView: (view: MainView) => void;
  readonly setInspectorTab: (tab: InspectorTab) => void;
}

type SetState = (
  partial: Partial<ViewSlice> | ((state: ViewSlice) => Partial<ViewSlice>),
) => void;

export function createViewSlice(set: SetState): ViewSlice {
  return {
    mainView: "feed",
    inspectorTab: "inspect",
    setMainView: (mainView) => set({ mainView }),
    setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  };
}
