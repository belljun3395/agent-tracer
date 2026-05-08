import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import {
  createUiStore,
  type UiStore,
  type UiStoreApi,
} from "./createUiStore.js";

const UiStoreContext = createContext<UiStoreApi | null>(null);

interface UiStoreProviderProps {
  readonly children: ReactNode;
  /**
   * Optional injected store. Tests use this to supply a fresh non-persisted
   * instance; in production the provider builds its own once per mount.
   */
  readonly store?: UiStoreApi;
}

export function UiStoreProvider({ children, store }: UiStoreProviderProps) {
  const [instance] = useState<UiStoreApi>(() => store ?? createUiStore());
  return (
    <UiStoreContext.Provider value={instance}>{children}</UiStoreContext.Provider>
  );
}

/**
 * Subscribe to a slice of the UI store. All UI state (selection, view,
 * sidebar filter) is read through this hook.
 */
export function useUiStore<T>(selector: (state: UiStore) => T): T {
  const ctx = useContext(UiStoreContext);
  if (ctx === null) {
    throw new Error("useUiStore must be used within <UiStoreProvider>");
  }
  return useStore(ctx, selector);
}
