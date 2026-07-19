import { beforeEach, describe, expect, it, vi } from "vitest";
import { TagId, TaskId } from "~web/shared/identity.js";
import {
  deleteRequest,
  getJson,
  patchJson,
  patchPut,
  postJson,
} from "~web/shared/api/client/json-methods.js";
import {
  createTag,
  deleteTag,
  fetchTags,
  fetchTasksByTag,
  fetchTaskTags,
  setTaskTags,
  updateTag,
} from "~web/entities/tag/api/api-tags.js";

vi.mock("~web/shared/api/client/json-methods.js", () => ({
  deleteRequest: vi.fn(),
  getJson: vi.fn(),
  patchJson: vi.fn(),
  patchPut: vi.fn(),
  postJson: vi.fn(),
}));

const mockGetJson = vi.mocked(getJson);
const mockPostJson = vi.mocked(postJson);
const mockPatchJson = vi.mocked(patchJson);
const mockPatchPut = vi.mocked(patchPut);
const mockDeleteRequest = vi.mocked(deleteRequest);

function makeTagDto(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    userId: "user-1",
    name: `${id} name`,
    color: "#586069",
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  mockGetJson.mockReset();
  mockPostJson.mockReset();
  mockPatchJson.mockReset();
  mockPatchPut.mockReset();
  mockDeleteRequest.mockReset();
});

describe("fetchTags", () => {
  it("워크스페이스 태그 전체를 태스크 개수와 함께 화면 모델로 변환한다", async () => {
    mockGetJson.mockResolvedValue({ items: [makeTagDto("tag-1", { taskCount: 3 })] });

    const response = await fetchTags();

    expect(mockGetJson).toHaveBeenCalledWith("/api/v1/tags");
    expect(response.tags[0]).toMatchObject({ id: "tag-1", taskCount: 3 });
  });
});

describe("createTag", () => {
  it("이름과 색으로 새 태그를 만든다", async () => {
    mockPostJson.mockResolvedValue({ tag: makeTagDto("tag-1") });

    const response = await createTag({ name: "bug", color: "#d73a4a" });

    expect(mockPostJson).toHaveBeenCalledWith("/api/v1/tags", {
      name: "bug",
      color: "#d73a4a",
    });
    expect(response.tag.id).toBe("tag-1");
  });
});

describe("updateTag", () => {
  it("태그 하나를 수정한다", async () => {
    mockPatchJson.mockResolvedValue({ tag: makeTagDto("tag-1", { name: "renamed" }) });

    const response = await updateTag(TagId("tag-1"), { name: "renamed" });

    expect(mockPatchJson).toHaveBeenCalledWith("/api/v1/tags/tag-1", { name: "renamed" });
    expect(response.tag.name).toBe("renamed");
  });
});

describe("deleteTag", () => {
  it("태그 하나를 삭제한다", async () => {
    mockDeleteRequest.mockResolvedValue({ deleted: true });

    const response = await deleteTag(TagId("tag-1"));

    expect(mockDeleteRequest).toHaveBeenCalledWith("/api/v1/tags/tag-1");
    expect(response.deleted).toBe(true);
  });
});

describe("fetchTaskTags", () => {
  it("태스크 하나에 붙은 태그 목록을 요청한다", async () => {
    mockGetJson.mockResolvedValue({ taskId: "task-1", tags: [makeTagDto("tag-1")] });

    const response = await fetchTaskTags(TaskId("task-1"));

    expect(mockGetJson).toHaveBeenCalledWith("/api/v1/task-tags?taskId=task-1");
    expect(response.taskId).toBe("task-1");
    expect(response.tags.map((tag) => tag.id)).toEqual(["tag-1"]);
  });
});

describe("fetchTasksByTag", () => {
  it("태그 하나에 붙은 태스크 id 목록을 요청한다", async () => {
    mockGetJson.mockResolvedValue({ tagId: "tag-1", taskIds: ["task-1", "task-2"] });

    const response = await fetchTasksByTag(TagId("tag-1"));

    expect(mockGetJson).toHaveBeenCalledWith("/api/v1/task-tags?tagId=tag-1");
    expect(response.taskIds).toEqual(["task-1", "task-2"]);
  });
});

describe("setTaskTags", () => {
  it("태스크의 태그 집합을 통째로 치환한다", async () => {
    mockPatchPut.mockResolvedValue({ taskId: "task-1", tags: [makeTagDto("tag-1")] });

    const response = await setTaskTags(TaskId("task-1"), [TagId("tag-1")]);

    expect(mockPatchPut).toHaveBeenCalledWith("/api/v1/task-tags", {
      taskId: "task-1",
      tagIds: ["tag-1"],
    });
    expect(response.tags.map((tag) => tag.id)).toEqual(["tag-1"]);
  });
});
