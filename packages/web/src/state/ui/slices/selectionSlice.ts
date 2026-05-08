import type { EventId, TaskId } from "~domain/monitoring.js";

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
    /**
     * Switching task always clears the event selection — an event id from
     * task A is meaningless once we're focused on task B.
     */
    setSelectedTaskId: (selectedTaskId) =>
      set({ selectedTaskId, selectedEventId: null }),
    setSelectedEventId: (selectedEventId) => set({ selectedEventId }),
  };
}
