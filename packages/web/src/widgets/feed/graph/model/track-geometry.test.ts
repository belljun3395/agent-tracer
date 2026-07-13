import { describe, expect, test } from "vitest";
import {
  LANE_HEIGHT,
  LANE_LABEL_WIDTH,
  TRACK_LEFT_PADDING,
  laneCenterY,
  trackLeftCss,
  trackLeftPx,
} from "~web/widgets/feed/graph/model/track-geometry.js";

describe("laneCenterY", () => {
  test("첫 레인의 중심을 레인 높이 절반에 둔다", () => {
    expect(laneCenterY(0)).toBe(LANE_HEIGHT / 2);
  });

  test("레인 순서에 따라 중심을 같은 간격으로 이동한다", () => {
    expect(laneCenterY(2)).toBe(2 * LANE_HEIGHT + LANE_HEIGHT / 2);
  });
});

describe("trackLeftCss / trackLeftPx", () => {
  test("0%를 시간축 시작 지점으로 해석한다", () => {
    expect(trackLeftCss(0)).toContain(`${LANE_LABEL_WIDTH + TRACK_LEFT_PADDING}px`);
    expect(trackLeftPx(0, 1000)).toBe(LANE_LABEL_WIDTH + TRACK_LEFT_PADDING);
  });

  test("100%를 내부 너비 끝으로 해석한다", () => {
    expect(trackLeftPx(100, 1000)).toBe(1000);
  });

  test("중간 퍼센트를 선형 좌표로 해석한다", () => {
    const start = trackLeftPx(0, 1000);
    const end = trackLeftPx(100, 1000);
    expect(trackLeftPx(50, 1000)).toBeCloseTo((start + end) / 2, 5);
  });
});
