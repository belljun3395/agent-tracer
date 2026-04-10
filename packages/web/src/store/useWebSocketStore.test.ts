import { beforeEach, describe, expect, it } from "vitest";
import { _wsStore } from "@monitor/web-store";
beforeEach(() => {
    _wsStore.getState().setConnected(false);
});
describe("useWebSocketStore — initial state", () => {
    it("initialises isConnected as false", () => {
        const { wsState } = _wsStore.getState();
        expect(wsState.isConnected).toBe(false);
    });
});
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
