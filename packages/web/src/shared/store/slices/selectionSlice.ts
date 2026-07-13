import type { EventId, TaskId } from "~web/shared/identity.js";

export interface SelectionSlice {
  readonly selectedTaskId: TaskId | null;
  readonly selectedEventId: EventId | null;
  readonly setSelectedTaskId: (id: TaskId | null) => void;
  readonly setSelectedEventId: (id: EventId | null) => void;
}

type SetState = (
  partial:
    | Partial<SelectionSlice>
    | ((state: SelectionSlice) => Partial<SelectionSlice>),
) => void;

export function createSelectionSlice(set: SetState): SelectionSlice {
  return {
    selectedTaskId: null,
    selectedEventId: null,
    /** 태스크를 바꾸면 항상 이벤트 선택을 지운다. */
    setSelectedTaskId: (selectedTaskId) =>
      set({ selectedTaskId, selectedEventId: null }),
    setSelectedEventId: (selectedEventId) => set({ selectedEventId }),
  };
}
