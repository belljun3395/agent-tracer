/**
 * Smoke tests for useEventStore (event slice).
 *
 * Verifies default initial state and basic state mutations via
 * dispatchEventAction.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { _eventStore } from "./useEventStore.js";

// ---------------------------------------------------------------------------
// Reset store state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  const dispatch = _eventStore.getState().dispatchEventAction;
  dispatch({ type: "RESET_EVENT_FILTERS" });
  dispatch({ type: "SELECT_EVENT", eventId: null });
  dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
});

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

describe("useEventStore — initial state", () => {
  it("initialises selectedEventId as null", () => {
    const { eventState } = _eventStore.getState();
    expect(eventState.selectedEventId).toBeNull();
  });

  it("initialises selectedConnectorKey as null", () => {
    const { eventState } = _eventStore.getState();
    expect(eventState.selectedConnectorKey).toBeNull();
  });

  it("initialises selectedRuleId as null", () => {
    const { eventState } = _eventStore.getState();
    expect(eventState.selectedRuleId).toBeNull();
  });

  it("initialises selectedTag as null", () => {
    const { eventState } = _eventStore.getState();
    expect(eventState.selectedTag).toBeNull();
  });

  it("initialises showRuleGapsOnly as false", () => {
    const { eventState } = _eventStore.getState();
    expect(eventState.showRuleGapsOnly).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Basic mutations
// ---------------------------------------------------------------------------

describe("useEventStore — SELECT_EVENT", () => {
  it("sets selectedEventId when dispatching SELECT_EVENT with a string", () => {
    _eventStore.getState().dispatchEventAction({ type: "SELECT_EVENT", eventId: "evt-1" });
    expect(_eventStore.getState().eventState.selectedEventId).toBe("evt-1");
  });

  it("clears selectedEventId when dispatching SELECT_EVENT with null", () => {
    _eventStore.getState().dispatchEventAction({ type: "SELECT_EVENT", eventId: "evt-1" });
    _eventStore.getState().dispatchEventAction({ type: "SELECT_EVENT", eventId: null });
    expect(_eventStore.getState().eventState.selectedEventId).toBeNull();
  });
});

describe("useEventStore — SELECT_CONNECTOR", () => {
  it("sets selectedConnectorKey", () => {
    _eventStore.getState().dispatchEventAction({ type: "SELECT_CONNECTOR", connectorKey: "evt-1→evt-2:0" });
    expect(_eventStore.getState().eventState.selectedConnectorKey).toBe("evt-1→evt-2:0");
  });

  it("clears selectedConnectorKey with null", () => {
    _eventStore.getState().dispatchEventAction({ type: "SELECT_CONNECTOR", connectorKey: "evt-1→evt-2:0" });
    _eventStore.getState().dispatchEventAction({ type: "SELECT_CONNECTOR", connectorKey: null });
    expect(_eventStore.getState().eventState.selectedConnectorKey).toBeNull();
  });
});

describe("useEventStore — SELECT_RULE", () => {
  it("sets selectedRuleId", () => {
    _eventStore.getState().dispatchEventAction({ type: "SELECT_RULE", ruleId: "rule-abc" });
    expect(_eventStore.getState().eventState.selectedRuleId).toBe("rule-abc");
  });
});

describe("useEventStore — SELECT_TAG", () => {
  it("sets selectedTag", () => {
    _eventStore.getState().dispatchEventAction({ type: "SELECT_TAG", tag: "implementation" });
    expect(_eventStore.getState().eventState.selectedTag).toBe("implementation");
  });
});

describe("useEventStore — SET_SHOW_RULE_GAPS_ONLY", () => {
  it("sets showRuleGapsOnly to true", () => {
    _eventStore.getState().dispatchEventAction({ type: "SET_SHOW_RULE_GAPS_ONLY", show: true });
    expect(_eventStore.getState().eventState.showRuleGapsOnly).toBe(true);
  });

  it("sets showRuleGapsOnly to false", () => {
    _eventStore.getState().dispatchEventAction({ type: "SET_SHOW_RULE_GAPS_ONLY", show: true });
    _eventStore.getState().dispatchEventAction({ type: "SET_SHOW_RULE_GAPS_ONLY", show: false });
    expect(_eventStore.getState().eventState.showRuleGapsOnly).toBe(false);
  });
});

describe("useEventStore — RESET_EVENT_FILTERS", () => {
  it("clears selectedRuleId, selectedTag, and showRuleGapsOnly but preserves event/connector selection", () => {
    _eventStore.getState().dispatchEventAction({ type: "SELECT_RULE", ruleId: "rule-1" });
    _eventStore.getState().dispatchEventAction({ type: "SELECT_TAG", tag: "planning" });
    _eventStore.getState().dispatchEventAction({ type: "SET_SHOW_RULE_GAPS_ONLY", show: true });
    _eventStore.getState().dispatchEventAction({ type: "SELECT_EVENT", eventId: "evt-kept" });

    _eventStore.getState().dispatchEventAction({ type: "RESET_EVENT_FILTERS" });

    const { eventState } = _eventStore.getState();
    expect(eventState.selectedRuleId).toBeNull();
    expect(eventState.selectedTag).toBeNull();
    expect(eventState.showRuleGapsOnly).toBe(false);
    // SELECT_EVENT is not part of RESET_EVENT_FILTERS — it stays
    expect(eventState.selectedEventId).toBe("evt-kept");
  });
});
