import { create } from "zustand";
export interface EventState {
    readonly selectedEventId: string | null;
    readonly selectedConnectorKey: string | null;
    readonly selectedRuleId: string | null;
    readonly selectedTag: string | null;
    readonly showRuleGapsOnly: boolean;
}
export type EventAction = {
    type: "SELECT_EVENT";
    eventId: string | null;
} | {
    type: "SELECT_CONNECTOR";
    connectorKey: string | null;
} | {
    type: "SELECT_RULE";
    ruleId: string | null;
} | {
    type: "SELECT_TAG";
    tag: string | null;
} | {
    type: "SET_SHOW_RULE_GAPS_ONLY";
    show: boolean;
} | {
    type: "RESET_EVENT_FILTERS";
};
export interface EventStoreSlice {
    eventState: EventState;
    dispatchEventAction: (action: EventAction) => void;
}
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
const INITIAL_EVENT_STATE: EventState = {
    selectedEventId: null,
    selectedConnectorKey: null,
    selectedRuleId: null,
    selectedTag: null,
    showRuleGapsOnly: false
};
export const _eventStore = create<EventStoreSlice>((set) => {
    function dispatch(action: EventAction): void {
        set((slice) => ({ eventState: applyEventAction(slice.eventState, action) }));
    }
    return {
        eventState: INITIAL_EVENT_STATE,
        dispatchEventAction: dispatch
    };
});
export function useEventStore(): EventStoreSlice {
    return _eventStore();
}
