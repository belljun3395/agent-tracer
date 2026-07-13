import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskId, TaskSlug, WorkspacePath } from "~web/shared/identity.js";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import { StatusPill } from "~web/widgets/feed/header/StatusPill.js";

const mutate = vi.fn();

afterEach(() => {
  cleanup();
  mutate.mockReset();
});

vi.mock("~web/entities/task/api/edit-mutations.js", () => ({
  useUpdateTaskMutation: () => ({ isPending: false, mutate }),
}));

describe("StatusPill", () => {
  it("상태 목록을 스크롤 컨테이너 밖의 포털에 표시한다", () => {
    render(<StatusPill task={makeTask()} />);

    fireEvent.click(screen.getByRole("button", { name: "Change task status" }));

    const listbox = screen.getByRole("listbox");
    expect(listbox.parentElement).toBe(document.body);
  });

  it("Escape를 누르면 열린 상태 목록을 닫는다", () => {
    render(<StatusPill task={makeTask()} />);

    fireEvent.click(screen.getByRole("button", { name: "Change task status" }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("포털 내부 상태를 선택하면 팝업을 닫고 상태를 변경한다", () => {
    render(<StatusPill task={makeTask()} />);

    fireEvent.click(screen.getByRole("button", { name: "Change task status" }));
    const option = screen.getByRole("option", { name: "Completed" });
    fireEvent.mouseDown(option);
    fireEvent.click(option);

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(mutate).toHaveBeenCalledWith({
      taskId: TaskId("task-1"),
      body: { status: "completed" },
    });
  });

  it("외부를 누르면 열린 상태 목록을 닫는다", () => {
    render(<StatusPill task={makeTask()} />);

    fireEvent.click(screen.getByRole("button", { name: "Change task status" }));
    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

function makeTask(): MonitoringTask {
  return {
    id: TaskId("task-1"),
    title: "테스트 작업",
    slug: TaskSlug("test-task"),
    workspacePath: WorkspacePath("/tmp/agent-tracer"),
    status: "waiting",
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:00.000Z",
  };
}
