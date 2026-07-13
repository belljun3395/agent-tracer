import { describe, expect, it } from "vitest";
import { centeredTrackScrollLeft } from "~web/widgets/feed/graph/viewport/geometry.js";

describe("centeredTrackScrollLeft", () => {
  it("오른쪽 빈 구간이 있어도 최신 노드의 시간축 좌표를 중앙에 둔다", () => {
    expect(centeredTrackScrollLeft(25, 8_000, 1_000)).toBe(1_579.5);
  });

  it("시간축 양 끝에서 유효한 스크롤 범위를 벗어나지 않는다", () => {
    expect(centeredTrackScrollLeft(0, 8_000, 1_000)).toBe(0);
    expect(centeredTrackScrollLeft(100, 8_000, 1_000)).toBe(7_000);
  });
});
