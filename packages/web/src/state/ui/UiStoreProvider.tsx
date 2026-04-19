import type React from "react";
import { createContext, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import {
    createUiStore,
    type EditStore,
    type EditStoreState,
    type SelectionStore,
    type SelectionStoreState,
    type UiStoreBundle
} from "./createUiStore.js";

const UiStoreContext = createContext<UiStoreBundle | null>(null);

export interface UiStoreProviderProps {
    readonly children: ReactNode;
    /**
     * Optional injected bundle. Primarily used in tests so each test can
     * own its own fresh selection/edit stores without touching module
     * state. In production the provider builds its own bundle once per
     * mount.
     */
    readonly bundle?: UiStoreBundle;
}

export function UiStoreProvider({ children, bundle }: UiStoreProviderProps): React.JSX.Element {
    const ref = useRef<UiStoreBundle | null>(null);
    if (ref.current === null) {
        ref.current = bundle ?? createUiStore();
    }
    return <UiStoreContext.Provider value={ref.current}>{children}</UiStoreContext.Provider>;
}

function useUiStore(): UiStoreBundle {
    const ctx = useContext(UiStoreContext);
    if (ctx === null) {
        throw new Error(
            "useSelectionStore/useEditStore must be used within <UiStoreProvider>."
        );
    }
    return ctx;
}

/** Access the underlying selection store API (`.getState`, `.setState`, `.subscribe`). */
export function useSelectionStoreApi(): SelectionStore {
    return useUiStore().selection;
}

/** Access the underlying edit store API. */
export function useEditStoreApi(): EditStore {
    return useUiStore().edit;
}

/** Subscribe to a slice of the selection store. */
export function useSelectionStore<T>(selector: (state: SelectionStoreState) => T): T {
    const store = useSelectionStoreApi();
    return useStore(store, selector);
}

/** Subscribe to a slice of the edit store. */
export function useEditStore<T>(selector: (state: EditStoreState) => T): T {
    const store = useEditStoreApi();
    return useStore(store, selector);
}
