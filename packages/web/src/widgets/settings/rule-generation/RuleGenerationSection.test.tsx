import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { RuleGenerationSection } from "~web/widgets/settings/rule-generation/RuleGenerationSection.js";

vi.mock("~web/entities/setting/api/queries.js", () => ({
  useAppSettingsQuery: () => ({
    data: { settings: [] },
    isLoading: false,
  }),
}));

vi.mock("~web/entities/setting/api/mutations.js", () => ({
  usePutAppSettingMutation: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useDeleteAppSettingMutation: () => ({
    mutateAsync: vi.fn(),
  }),
}));

describe("규칙 생성 설정", () => {
  afterEach(cleanup);

  it("AI 출력 언어와 브라우저 설명 언어의 범위를 분리해 안내한다", () => {
    const store = createUiStore({ persisted: false });
    const { container } = render(
      <UiStoreProvider store={store}>
        <RuleGenerationSection />
      </UiStoreProvider>,
    );

    expect(container.textContent).toContain(
      "recipe generation does not currently use this global setting",
    );

    act(() => store.getState().setGuidanceLocale("ko"));

    expect(container.textContent).toContain(
      "현재 레시피 생성에는 이 전역 설정이 적용되지 않습니다",
    );
    expect(screen.getByText("Output language").textContent).toBe(
      "Output language",
    );
    expect(container.querySelectorAll('[lang="ko"]').length).toBeGreaterThan(0);
  });
});
