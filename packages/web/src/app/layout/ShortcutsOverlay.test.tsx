import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { ShortcutsOverlay } from "~web/app/layout/ShortcutsOverlay.js";

describe("ShortcutsOverlay", () => {
  it("짧은 화면에서 패널 높이를 제한하고 목록만 스크롤한다", () => {
    const store = createUiStore({ persisted: false });
    store.getState().setShortcutsOpen(true);

    render(
      <UiStoreProvider store={store}>
        <ShortcutsOverlay />
      </UiStoreProvider>,
    );

    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    const panel = within(dialog).getByRole("heading", {
      name: "Keyboard shortcuts",
    }).parentElement?.parentElement;
    const list = within(dialog).getByRole("list");

    expect(dialog.classList.contains("overflow-y-auto")).toBe(true);
    expect(panel?.classList.contains("max-h-[calc(100dvh-2rem)]")).toBe(true);
    expect(panel?.classList.contains("flex")).toBe(true);
    expect(panel?.classList.contains("flex-col")).toBe(true);
    expect(list.classList.contains("min-h-0")).toBe(true);
    expect(list.classList.contains("overflow-y-auto")).toBe(true);
  });
});
