import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { SettingsPage } from "~web/pages/settings/SettingsPage.js";

vi.mock("~web/widgets/settings/identity/IdentitySection.js", () => ({
  IdentitySection: () => <section>User identity placeholder</section>,
}));

vi.mock("~web/widgets/settings/rule-generation/RuleGenerationSection.js", () => ({
  RuleGenerationSection: () => <section>Rule generation placeholder</section>,
}));

vi.mock("~web/widgets/settings/daemon/DaemonHealthSection.js", () => ({
  DaemonHealthSection: () => <section>Daemon health placeholder</section>,
}));

describe("SettingsPage", () => {
  afterEach(cleanup);

  it("브라우저 설명 언어만 즉시 바꾸고 운영 레이블은 영어로 유지한다", () => {
    const store = createUiStore({ persisted: false });
    const { container } = render(
      <UiStoreProvider store={store}>
        <SettingsPage />
      </UiStoreProvider>,
    );
    const localeSelect = screen.getByRole<HTMLSelectElement>("combobox", {
      name: "Guidance language",
    });

    expect(container.textContent).toContain("Server settings are stored in PostgreSQL");
    expect(container.textContent).toContain("AES-256-GCM");
    expect(container.textContent).not.toContain("SQLite");
    expect(container.textContent).not.toContain("plain text");

    fireEvent.change(localeSelect, { target: { value: "ko" } });

    expect(store.getState().guidanceLocale).toBe("ko");
    expect(localeSelect.value).toBe("ko");
    expect(container.textContent).toContain("서버 설정은 PostgreSQL에 저장됩니다");
    expect(container.textContent).toContain("Guidance language");
    expect(container.querySelectorAll('[lang="ko"]').length).toBeGreaterThan(0);
  });
});
