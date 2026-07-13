import { describe, expect, it } from "vitest";
import { flattenTaskPages } from "~web/entities/task/model/task-pagination.js";

describe("flattenTaskPages", () => {
  it("여러 페이지의 태스크를 순서대로 이어붙인다", () => {
    const pages = [
      { tasks: [{ id: "a" }, { id: "b" }] as never[], page: { limit: 2, hasMore: true } },
      { tasks: [{ id: "c" }] as never[], page: { limit: 2, hasMore: false } },
    ];

    expect(flattenTaskPages(pages).map((task) => (task as { id: string }).id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("빈 페이지 목록은 빈 배열로 평탄화된다", () => {
    expect(flattenTaskPages([])).toEqual([]);
  });
});
