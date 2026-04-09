/**
 * Event slice — Zustand 5 store.
 *
 * Owns: selectedEventId, selectedConnectorKey, selectedRuleId,
 * selectedTag, showRuleGapsOnly.
 *
 * Previously part of the monolithic useMonitorStore; extracted for
 * focused responsibility. Consumers should continue to import from
 * useMonitorStore (backward-compat shim) unless they need direct slice access.
 */

import { create } from "zustand";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface EventState {
  readonly selectedEventId: string | null;
  readonly selectedConnectorKey: string | null;
  readonly selectedRuleId: string | null;
  readonly selectedTag: string | null;
  readonly showRuleGapsOnly: boolean;
}

// ---------------------------------------------------------------------------
// Action type
// ---------------------------------------------------------------------------

export type EventAction =
  | { type: "SELECT_EVENT"; eventId: string | null }
  | { type: "SELECT_CONNECTOR"; connectorKey: string | null }
  | { type: "SELECT_RULE"; ruleId: string | null }
  | { type: "SELECT_TAG"; tag: string | null }
  | { type: "SET_SHOW_RULE_GAPS_ONLY"; show: boolean }
  | { type: "RESET_EVENT_FILTERS" };

// ---------------------------------------------------------------------------
// Slice interface
// ---------------------------------------------------------------------------

export interface EventStoreSlice {
  eventState: EventState;
  dispatchEventAction: (action: EventAction) => void;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function applyEventAction(state: EventState, action: EventAction): EventState {
  switch (action.type) {
    case "SELECT_EVENT":
      return { ...state, selectedEventId: action.eventId };
    case "SELECT_CONNECTOR":
      return { ...state, selectedConnectorKey: action.connectorKey };
    case "SELECT_RULE":
      return { ...state, selectedRuleId: action.ruleId };
    case "SELECT_TAG":
      return { ...state, selectedTag: action.tag };
    case "SET_SHOW_RULE_GAPS_ONLY":
      return { ...state, showRuleGapsOnly: action.show };
    case "RESET_EVENT_FILTERS":
      return {
        ...state,
        selectedRuleId: null,
        selectedTag: null,
        showRuleGapsOnly: false
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_EVENT_STATE: EventState = {
  selectedEventId: null,
  selectedConnectorKey: null,
  selectedRuleId: null,
  selectedTag: null,
  showRuleGapsOnly: false
};

// ---------------------------------------------------------------------------
// Zustand store (singleton)
// ---------------------------------------------------------------------------

export const _eventStore = create<EventStoreSlice>((set) => {
  function dispatch(action: EventAction): void {
    set((slice) => ({ eventState: applyEventAction(slice.eventState, action) }));
  }

  return {
    eventState: INITIAL_EVENT_STATE,
    dispatchEventAction: dispatch
  };
});

/**
 * Public hook for the event slice.
 * Most consumers should use useMonitorStore() from useMonitorStore.tsx instead.
 */
export function useEventStore(): EventStoreSlice {
  return _eventStore();
}
