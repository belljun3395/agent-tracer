import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskId } from "~web/shared/identity.js";
import {
  deleteRequest,
  patchJson,
  postJson,
} from "~web/shared/api/client/json-methods.js";
import { archiveTask, unarchiveTask, updateTask } from "~web/entities/task/api/lifecycle.js";

vi.mock("~web/shared/api/client/json-methods.js", () => ({
  deleteRequest: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

const mockDeleteRequest = vi.mocked(deleteRequest);
const mockPatchJson = vi.mocked(patchJson);
const mockPostJson = vi.mocked(postJson);

beforeEach(() => {
  mockDeleteRequest.mockReset();
  mockPatchJson.mockReset();
  mockPostJson.mockReset();
});

describe("태스크 생명주기 전송", () => {
  it("보관·복원·수정을 각 HTTP 계약으로 전달한다", async () => {
    mockPostJson.mockResolvedValue({ taskId: "task-1", archived: true });
    mockDeleteRequest.mockResolvedValue({ taskId: "task-1", archived: false });
    mockPatchJson.mockResolvedValue({ task: { id: "task-1" } });
    const taskId = TaskId("task-1");

    await archiveTask(taskId);
    await unarchiveTask(taskId);
    await updateTask(taskId, { title: "renamed" });

    expect(mockPostJson).toHaveBeenCalledWith("/api/v1/tasks/task-1/archive");
    expect(mockDeleteRequest).toHaveBeenCalledWith("/api/v1/tasks/task-1/archive");
    expect(mockPatchJson).toHaveBeenCalledWith(
      "/api/v1/tasks/task-1",
      { title: "renamed" },
    );
  });
});
