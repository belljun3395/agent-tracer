import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import TasksRoute from "~web/pages/tasks/TasksPage.js";

describe("TasksRoute", () => {
  afterEach(cleanup);

  it("설명만 한국어로 바꾸고 빈 화면 제목은 영어로 유지한다", () => {
    const store = createUiStore({ persisted: false });
    const { container } = render(
      <UiStoreProvider store={store}>
        <TasksRoute />
      </UiStoreProvider>,
    );

    expect(container.textContent).toContain(
      "Each task collects every agent action in time order",
    );

    act(() => store.getState().setGuidanceLocale("ko"));

    expect(screen.getByRole("heading").textContent).toBe(
      "Pick a task from the sidebar",
    );
    expect(container.textContent).toContain(
      "각 태스크에는 에이전트의 모든 작업이 시간순으로 모입니다",
    );
    expect(container.querySelector('p[lang="ko"]')).not.toBeNull();
  });
});
