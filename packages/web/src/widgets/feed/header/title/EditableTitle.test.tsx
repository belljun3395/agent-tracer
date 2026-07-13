import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_AGENT_BACKEND, JOB_KIND } from "~web/entities/job/model/job.js";
import { TaskId, TaskSlug, WorkspacePath } from "~web/shared/identity.js";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TitleSuggestionJobStatus } from "~web/entities/job/model/title-suggestion.js";
import { TooltipProvider } from "~web/shared/ui/index.js";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { EditableTitle } from "~web/widgets/feed/header/title/EditableTitle.js";

const enqueueMutation = {
  isPending: false,
  mutate: vi.fn(),
};
const feedbackMutation = { mutate: vi.fn() };
const updateMutation = { isPending: false, mutate: vi.fn() };
const jobStatusState: {
  data: { readonly job: TitleSuggestionJobStatus | null } | undefined;
} = { data: undefined };

vi.mock("~web/entities/job/api/mutations.js", () => ({
  useEnqueueJob: () => enqueueMutation,
  useSubmitJobFeedbackMutation: () => feedbackMutation,
}));

vi.mock("~web/entities/task/api/edit-mutations.js", () => ({
  useUpdateTaskMutation: () => updateMutation,
}));

vi.mock("~web/entities/job/api/queries.js", () => ({
  useJobStatus: () => ({ data: jobStatusState.data }),
}));

describe("EditableTitle", () => {
  afterEach(() => {
    cleanup();
    enqueueMutation.mutate.mockClear();
    feedbackMutation.mutate.mockClear();
    updateMutation.mutate.mockClear();
    jobStatusState.data = undefined;
  });

  it("제목 편집 버튼 안에 다른 인터랙션 컨트롤을 중첩하지 않는다", () => {
    renderEditableTitle();

    const renameButton = screen.getByRole("button", {
      name: "Edit task title: 테스트 작업",
    });

    expect(renameButton.querySelector("button, select")).toBeNull();
  });

  it("Enter로 공백을 제거한 제목을 저장한다", () => {
    renderEditableTitle();

    fireEvent.click(screen.getByRole("button", {
      name: "Edit task title: 테스트 작업",
    }));
    const input = screen.getByRole("textbox", { name: "Task title" });
    fireEvent.change(input, { target: { value: "  새 제목  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(updateMutation.mutate).toHaveBeenCalledWith(
      {
        taskId: TaskId("task-1"),
        body: { title: "새 제목" },
      },
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );
  });

  it("Escape로 제목 편집을 취소한다", () => {
    renderEditableTitle();

    fireEvent.click(screen.getByRole("button", {
      name: "Edit task title: 테스트 작업",
    }));
    const input = screen.getByRole("textbox", { name: "Task title" });
    fireEvent.change(input, { target: { value: "버릴 제목" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(updateMutation.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", {
      name: "Edit task title: 테스트 작업",
    })).not.toBeNull();
  });

  it("제목 제안 버튼의 Enter와 Space 입력으로 제목 편집을 시작하지 않는다", () => {
    renderEditableTitle();
    const control = screen.getByRole("button", { name: "Suggest title" });

    fireEvent.keyDown(control, { key: "Enter" });
    expect(screen.queryByRole("textbox", { name: "Task title" })).toBeNull();

    fireEvent.keyDown(control, { key: " " });
    expect(screen.queryByRole("textbox", { name: "Task title" })).toBeNull();
  });

  it("백엔드 선택기를 제목 행이 아니라 제안 패널에 표시한다", () => {
    renderEditableTitle();

    expect(screen.queryByRole("combobox", { name: "Agent backend" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Suggest title" }));

    expect(screen.getByRole("combobox", { name: "Agent backend" })).not.toBeNull();
    expect(enqueueMutation.mutate).not.toHaveBeenCalled();
  });

  it("선택한 에이전트 백엔드로 제목 제안 잡을 요청한다", () => {
    renderEditableTitle();

    fireEvent.click(screen.getByRole("button", { name: "Suggest title" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Agent backend" }), {
      target: { value: AI_AGENT_BACKEND.claudeSdk },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Generate title suggestions" }),
    );

    expect(enqueueMutation.mutate).toHaveBeenCalledWith(
      {
        taskId: TaskId("task-1"),
        agentBackend: AI_AGENT_BACKEND.claudeSdk,
      },
      expect.any(Object),
    );
  });

  it("완료된 제안을 선택하면 수락 피드백과 제목 변경을 보낸다", () => {
    jobStatusState.data = {
      job: {
        id: "job-1",
        kind: JOB_KIND.titleSuggestion,
        status: "completed",
        attempts: 1,
        error: null,
        modelUsed: "gpt-5.4",
        durationMs: 1200,
        createdAt: "2026-07-13T00:00:00.000Z",
        updatedAt: "2026-07-13T00:00:01.200Z",
        startedAt: "2026-07-13T00:00:00.000Z",
        completedAt: "2026-07-13T00:00:01.200Z",
        result: {
          suggestions: [
            { title: "개선된 제목", rationale: "작업 의도가 명확해짐" },
          ],
        },
      },
    };
    renderEditableTitle();

    fireEvent.click(screen.getByRole("button", { name: "Suggest title" }));
    fireEvent.click(screen.getByRole("button", { name: /\uAC1C\uC120\uB41C \uC81C\uBAA9/u }));

    expect(feedbackMutation.mutate).toHaveBeenCalledWith({
      jobId: "job-1",
      kind: "accept",
    });
    expect(updateMutation.mutate).toHaveBeenCalledWith(
      {
        taskId: TaskId("task-1"),
        body: { title: "개선된 제목" },
      },
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );
  });

  it("제목 제안 패널을 body 포털에 표시한다", () => {
    renderEditableTitle();

    fireEvent.click(screen.getByRole("button", { name: "Suggest title" }));

    expect(
      screen.getByRole("dialog", { name: "Title suggestions" }).parentElement,
    ).toBe(document.body);
  });

  it("Escape로 제목 제안 패널을 닫는다", () => {
    renderEditableTitle();

    fireEvent.click(screen.getByRole("button", { name: "Suggest title" }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Title suggestions" })).toBeNull();
  });
});

function renderEditableTitle() {
  const store = createUiStore({ persisted: false });
  return render(
    <UiStoreProvider store={store}>
      <TooltipProvider>
        <EditableTitle task={makeTask()} />
      </TooltipProvider>
    </UiStoreProvider>,
  );
}

function makeTask(): MonitoringTask {
  return {
    id: TaskId("task-1"),
    title: "테스트 작업",
    slug: TaskSlug("test-task"),
    workspacePath: WorkspacePath("/tmp/agent-tracer"),
    status: "running",
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:00.000Z",
  };
}
