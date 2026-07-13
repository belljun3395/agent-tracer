import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { JobDto } from "@monitor/kernel";
import { JOB_KIND, JOB_STATUS } from "~web/entities/job/model/job.js";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { TooltipProvider } from "~web/shared/ui/index.js";
import { JobsPage } from "~web/pages/jobs/JobsPage.js";

const historyState = vi.hoisted(() => ({
  filters: [] as unknown[],
  data: { items: [] as JobDto[], total: 0 },
}));

vi.mock("~web/entities/job/api/queries.js", () => ({
  useJobsHistoryQuery: (filters: unknown) => {
    historyState.filters.push(filters);
    return {
      data: historyState.data,
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    };
  },
}));

vi.mock("~web/entities/job/api/mutations.js", () => ({
  useCancelJobMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("~web/widgets/jobs/detail/JobDetailPanel.js", () => ({
  JobDetailPanel: ({ jobId }: { readonly jobId: string }) => <div>Details {jobId}</div>,
}));

beforeEach(() => {
  historyState.filters.length = 0;
  historyState.data = {
    items: [
      makeJob({ id: "job-1", status: JOB_STATUS.completed }),
      makeJob({ id: "job-2", status: JOB_STATUS.canceled, kind: JOB_KIND.ruleGeneration }),
    ],
    total: 2,
  };
});

afterEach(() => cleanup());

describe("잡 이력 화면", () => {
  it("잡 이력의 컬럼과 실제 상태를 텍스트로 표시한다", () => {
    renderJobs();

    expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Job" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Created" })).toBeTruthy();
    expect(screen.getByLabelText("Job history, 2 total")).toBeTruthy();
    expect(screen.getByText("Canceled", { selector: "span" })).toBeTruthy();
  });

  it("필터를 바꾸면 현재 잡 선택과 페이지를 초기화한다", () => {
    renderJobs("/jobs?job=job-1&page=3");

    fireEvent.click(screen.getByRole("button", { name: "Failed" }));

    expect(screen.getByRole("button", { name: "Failed" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("현재 주소").textContent).toBe("?status=failed");
  });

  it("전체 건수를 알리고 다음 페이지를 조회한다", () => {
    historyState.data = {
      items: Array.from({ length: 25 }, (_, index) => makeJob({ id: `job-${index + 1}` })),
      total: 60,
    };
    renderJobs();

    expect(screen.getByText("1–25 / 60")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByLabelText("현재 주소").textContent).toBe("?page=2");
    expect(historyState.filters.at(-1)).toEqual({ limit: 25, offset: 25 });
  });

  it("Escape 키로 열린 잡 상세를 닫는다", () => {
    renderJobs("/jobs?job=job-1");

    expect(screen.getByRole("dialog", { name: "Job details" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.getByLabelText("현재 주소").textContent).toBe("");
  });
});

function renderJobs(initialEntry = "/jobs") {
  const store = createUiStore({ persisted: false });
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <UiStoreProvider store={store}>
        <TooltipProvider>
          <JobsPage />
          <LocationProbe />
        </TooltipProvider>
      </UiStoreProvider>
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="현재 주소">{location.search}</output>;
}

function makeJob(overrides: Partial<JobDto> = {}): JobDto {
  return {
    id: "job-1",
    userId: "u1",
    kind: JOB_KIND.titleSuggestion,
    executor: "temporal",
    status: JOB_STATUS.completed,
    attempts: 1,
    taskId: "task-1",
    input: {},
    result: { suggestions: [{ title: "제안", rationale: "근거" }] },
    usage: {},
    error: null,
    createdAt: "2026-07-10T09:00:00.000Z",
    updatedAt: "2026-07-10T09:00:06.000Z",
    startedAt: "2026-07-10T09:00:00.000Z",
    completedAt: "2026-07-10T09:00:06.000Z",
    ...overrides,
  };
}
