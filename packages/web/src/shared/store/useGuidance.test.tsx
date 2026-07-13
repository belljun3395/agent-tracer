import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { UiStoreProvider } from "~web/shared/store/UiStoreProvider.js";
import { createUiStore } from "~web/shared/store/createUiStore.js";
import { useGuidance } from "~web/shared/store/useGuidance.js";

describe("useGuidance", () => {
  it("locale 원시값만 구독하고 locale별 고정 bundle을 반환한다", () => {
    const store = createUiStore({ persisted: false });
    let renderCount = 0;
    const { result } = renderHook(
      () => {
        renderCount += 1;
        return useGuidance();
      },
      {
        wrapper: ({ children }: { readonly children: ReactNode }) => (
          <UiStoreProvider store={store}>{children}</UiStoreProvider>
        ),
      },
    );
    const englishBundle = result.current;

    act(() => store.getState().setTheme("dark"));

    expect(renderCount).toBe(1);
    expect(result.current).toBe(englishBundle);

    act(() => store.getState().setGuidanceLocale("ko"));
    const koreanBundle = result.current;

    expect(renderCount).toBe(2);
    expect(koreanBundle.locale).toBe("ko");
    expect(Object.isFrozen(koreanBundle)).toBe(true);

    act(() => store.getState().setGuidanceLocale("ko"));
    expect(renderCount).toBe(2);

    act(() => store.getState().setGuidanceLocale("en"));
    act(() => store.getState().setGuidanceLocale("ko"));

    expect(result.current).toBe(koreanBundle);
  });
});
