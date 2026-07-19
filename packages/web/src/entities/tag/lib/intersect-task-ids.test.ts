import { describe, expect, it } from "vitest";
import { TaskId } from "~web/shared/identity.js";
import { intersectTaskIdSets } from "~web/entities/tag/lib/intersect-task-ids.js";

describe("intersectTaskIdSets", () => {
  it("모든 집합에 공통으로 있는 태스크 id만 남긴다", () => {
    const sets = [
      new Set([TaskId("a"), TaskId("b"), TaskId("c")]),
      new Set([TaskId("b"), TaskId("c"), TaskId("d")]),
    ];

    expect([...intersectTaskIdSets(sets)]).toEqual([TaskId("b"), TaskId("c")]);
  });

  it("집합이 하나면 그대로 반환한다", () => {
    const sets = [new Set([TaskId("a"), TaskId("b")])];

    expect([...intersectTaskIdSets(sets)]).toEqual([TaskId("a"), TaskId("b")]);
  });

  it("집합이 없으면 빈 집합을 반환한다", () => {
    expect(intersectTaskIdSets([]).size).toBe(0);
  });

  it("공통 원소가 없으면 빈 집합을 반환한다", () => {
    const sets = [new Set([TaskId("a")]), new Set([TaskId("b")])];

    expect(intersectTaskIdSets(sets).size).toBe(0);
  });
});
