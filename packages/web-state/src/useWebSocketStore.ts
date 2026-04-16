import { create } from "zustand";
export interface WebSocketState {
    readonly isConnected: boolean;
}
export interface WebSocketStoreSlice {
    wsState: WebSocketState;
    setConnected: (isConnected: boolean) => void;
}
const INITIAL_WS_STATE: WebSocketState = {
    isConnected: false
};
export const _wsStore = create<WebSocketStoreSlice>((set) => ({
    wsState: INITIAL_WS_STATE,
    setConnected: (isConnected: boolean) => set((slice) => {
        if (slice.wsState.isConnected === isConnected)
            return slice;
        return { wsState: { isConnected } };
    })
}));
