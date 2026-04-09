/**
 * Smoke tests for useWebSocketStore (WebSocket connection-state slice).
 *
 * Verifies default initial state and the setConnected mutation, including
 * its identity-preserving optimisation (no state change when value unchanged).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { _wsStore } from "./useWebSocketStore.js";

// ---------------------------------------------------------------------------
// Reset store state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  _wsStore.getState().setConnected(false);
});

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

describe("useWebSocketStore — initial state", () => {
  it("initialises isConnected as false", () => {
    const { wsState } = _wsStore.getState();
    expect(wsState.isConnected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Basic mutations
// ---------------------------------------------------------------------------

describe("useWebSocketStore — setConnected", () => {
  it("sets isConnected to true", () => {
    _wsStore.getState().setConnected(true);
    expect(_wsStore.getState().wsState.isConnected).toBe(true);
  });

  it("sets isConnected back to false", () => {
    _wsStore.getState().setConnected(true);
    _wsStore.getState().setConnected(false);
    expect(_wsStore.getState().wsState.isConnected).toBe(false);
  });

  it("preserves state object identity when value does not change (no spurious re-renders)", () => {
    _wsStore.getState().setConnected(true);
    const before = _wsStore.getState().wsState;

    _wsStore.getState().setConnected(true);
    const after = _wsStore.getState().wsState;

    expect(after).toBe(before);
  });

  it("produces a new state object when value changes", () => {
    const before = _wsStore.getState().wsState;

    _wsStore.getState().setConnected(true);
    const after = _wsStore.getState().wsState;

    expect(after).not.toBe(before);
  });
});
