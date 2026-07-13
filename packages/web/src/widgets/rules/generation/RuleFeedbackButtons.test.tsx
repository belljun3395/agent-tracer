import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JOB_FEEDBACK_KIND } from "@monitor/kernel";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { RuleFeedbackButtons } from "~web/widgets/rules/generation/RuleFeedbackButtons.js";

const mutateAsync = vi.fn();

vi.mock("~web/entities/job/api/mutations.js", () => ({
  useSubmitJobFeedbackMutation: () => ({
    mutateAsync,
    isPending: false,
  }),
}));

afterEach(() => cleanup());

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue({});
});

describe("RuleFeedbackButtons", () => {
  it("고르기만 하면 아직 제출하지 않는다", () => {
    renderFeedbackButtons();

    fireEvent.click(screen.getByRole("button", { name: "Mark rule as useful" }));

    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("저장하면 규칙 id를 대상으로 피드백을 제출한다", () => {
    renderFeedbackButtons();

    fireEvent.click(screen.getByRole("button", { name: "Mark rule as useful" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mutateAsync).toHaveBeenCalledWith({
      jobId: "job-1",
      targetId: "rule-1",
      kind: JOB_FEEDBACK_KIND.accept,
    });
  });

  it("설명 언어만 한국어로 바꾸고 조작 라벨은 영어로 유지한다", () => {
    renderFeedbackButtons("ko");

    const prompt = screen.getByText("이 규칙은 얼마나 유용했나요?");
    expect(prompt.getAttribute("lang")).toBe("ko");
    expect(screen.getByRole("button", { name: "Mark rule as useful" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark rule as not useful" })).toBeTruthy();
  });
});

function renderFeedbackButtons(locale: "en" | "ko" = "en") {
  const store = createUiStore({ persisted: false });
  store.getState().setGuidanceLocale(locale);
  return render(
    <UiStoreProvider store={store}>
      <RuleFeedbackButtons jobId="job-1" ruleId="rule-1" />
    </UiStoreProvider>,
  );
}
