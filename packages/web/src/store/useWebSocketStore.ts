/**
 * WebSocket slice — Zustand 5 store.
 *
 * Owns: isConnected (the connection state flag synced from the WebSocket hook).
 *
 * Previously part of the monolithic useMonitorStore; extracted for
 * focused responsibility. The useWebSocket hook continues to live in
 * useWebSocket.ts and exposes a plain React hook — this store acts as a
 * global sink so consumers that do not render the WebSocket hook directly
 * can still read connection state.
 *
 * Consumers should continue to import from useMonitorStore (backward-compat
 * shim) unless they need direct slice access.
 */

import { create } from "zustand";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface WebSocketState {
  readonly isConnected: boolean;
}

// ---------------------------------------------------------------------------
// Slice interface
// ---------------------------------------------------------------------------

export interface WebSocketStoreSlice {
  wsState: WebSocketState;
  setConnected: (isConnected: boolean) => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_WS_STATE: WebSocketState = {
  isConnected: false
};

// ---------------------------------------------------------------------------
// Zustand store (singleton)
// ---------------------------------------------------------------------------

export const _wsStore = create<WebSocketStoreSlice>((set) => ({
  wsState: INITIAL_WS_STATE,
  setConnected: (isConnected: boolean) =>
    set((slice) => {
      if (slice.wsState.isConnected === isConnected) return slice;
      return { wsState: { isConnected } };
    })
}));

/**
 * Public hook for the WebSocket connection-state slice.
 * Most consumers should use useMonitorStore() from useMonitorStore.tsx instead.
 */
export function useWebSocketStore(): WebSocketStoreSlice {
  return _wsStore();
}
