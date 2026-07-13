import { describe, expect, it } from "vitest";
import { scanAnchorTaskQuery } from "~web/entities/task/model/task-query.js";

describe("scanAnchorTaskQuery", () => {
  it("스캔 앵커를 사용자 완료 루트 태스크로 제한한다", () => {
    expect(scanAnchorTaskQuery(false)).toEqual({
      origin: "user",
      status: "completed",
      rootOnly: true,
      archived: "active",
    });
  });

  it("보관 포함을 선택하면 archived 필터만 해제한다", () => {
    expect(scanAnchorTaskQuery(true)).toEqual({
      origin: "user",
      status: "completed",
      rootOnly: true,
      archived: "all",
    });
  });
});
