import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JOB_FEEDBACK_KIND } from "@monitor/kernel";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { JobFeedbackBar } from "~web/features/job-feedback/JobFeedbackBar.js";

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

describe("잡 결과 피드백", () => {
  it("고르기만 하면 아직 제출하지 않는다", () => {
    renderFeedback();

    fireEvent.click(screen.getByRole("button", { name: "Useful" }));
    fireEvent.click(screen.getByRole("button", { name: "Rating 4 of 5" }));

    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("유용해요를 고르고 저장하면 수락 피드백을 제출한다", () => {
    renderFeedback();

    fireEvent.click(screen.getByRole("button", { name: "Useful" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({
      jobId: "job-1",
      kind: JOB_FEEDBACK_KIND.accept,
    });
  });

  it("유용성과 별점을 함께 고르면 저장 한 번으로 둘 다 제출한다", () => {
    renderFeedback();

    fireEvent.click(screen.getByRole("button", { name: "Useful" }));
    fireEvent.click(screen.getByRole("button", { name: "Rating 4 of 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mutateAsync).toHaveBeenCalledTimes(2);
    expect(mutateAsync).toHaveBeenCalledWith({
      jobId: "job-1",
      kind: JOB_FEEDBACK_KIND.accept,
    });
    expect(mutateAsync).toHaveBeenCalledWith({
      jobId: "job-1",
      kind: JOB_FEEDBACK_KIND.rating,
      ratingValue: 4,
    });
  });

  it("고르지 않으면 저장이 비활성이다", () => {
    renderFeedback();

    const save = screen.getByRole("button", { name: "Save" });
    fireEvent.click(save);

    expect(save.hasAttribute("disabled")).toBe(true);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("적용 행동이 아니라 평가임이 드러나는 라벨을 쓴다", () => {
    renderFeedback();

    expect(screen.getByRole("button", { name: "Not useful" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Apply/ })).toBeNull();
  });
});

function renderFeedback() {
  const store = createUiStore({ persisted: false });
  return render(
    <UiStoreProvider store={store}>
      <JobFeedbackBar jobId="job-1" subject="rule" />
    </UiStoreProvider>,
  );
}
