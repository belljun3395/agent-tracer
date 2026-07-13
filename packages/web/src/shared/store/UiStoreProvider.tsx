import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import {
  createUiStore,
  type UiStore,
  type UiStoreApi,
} from "~web/shared/store/createUiStore.js";

const UiStoreContext = createContext<UiStoreApi | null>(null);

interface UiStoreProviderProps {
  readonly children: ReactNode;
  /**
   * 선택적으로 주입하는 store. 테스트는 이를 통해 영속화되지 않은 새
   * 인스턴스를 공급하고, 프로덕션에서는 provider가 마운트마다 자체
   * 생성한다.
   */
  readonly store?: UiStoreApi;
}

export function UiStoreProvider({ children, store }: UiStoreProviderProps) {
  const [instance] = useState<UiStoreApi>(() => store ?? createUiStore());
  return (
    <UiStoreContext.Provider value={instance}>{children}</UiStoreContext.Provider>
  );
}

/** UI store의 일부 상태를 구독한다. */
export function useUiStore<T>(selector: (state: UiStore) => T): T {
  const ctx = useContext(UiStoreContext);
  if (ctx === null) {
    throw new Error("useUiStore must be used within <UiStoreProvider>");
  }
  return useStore(ctx, selector);
}
