import { describe, expect, it } from "vitest";
import { calculateAnchoredPopoverPlacement } from "~web/shared/ui/overlays/anchored-popover-placement.js";

describe("calculateAnchoredPopoverPlacement", () => {
  it("선호 폭을 뷰포트 여백 안으로 제한한다", () => {
    const placement = calculateAnchoredPopoverPlacement({
      anchor: { top: 40, right: 310, bottom: 64, left: 286 },
      viewport: { width: 320, height: 640 },
      preferredWidth: 520,
      contentHeight: 180,
      preferredMaxHeight: 400,
      gutter: 12,
      gap: 8,
    });

    expect(placement).toMatchObject({
      side: "below",
      left: 12,
      top: 72,
      width: 296,
      maxHeight: 400,
    });
  });

  it("오른쪽 경계를 넘는 시작 좌표를 안쪽으로 보정한다", () => {
    const placement = calculateAnchoredPopoverPlacement({
      anchor: { top: 40, right: 310, bottom: 64, left: 286 },
      viewport: { width: 400, height: 640 },
      preferredWidth: 240,
      contentHeight: 180,
      preferredMaxHeight: 400,
      gutter: 12,
      gap: 8,
    });

    expect(placement.left).toBe(148);
    expect(placement.width).toBe(240);
  });

  it("아래 공간이 부족하고 위 공간이 넓으면 앵커 위에 배치한다", () => {
    const placement = calculateAnchoredPopoverPlacement({
      anchor: { top: 520, right: 220, bottom: 544, left: 180 },
      viewport: { width: 800, height: 600 },
      preferredWidth: 320,
      contentHeight: 240,
      preferredMaxHeight: 320,
      gutter: 12,
      gap: 8,
    });

    expect(placement).toMatchObject({
      side: "above",
      left: 180,
      top: 272,
      width: 320,
      maxHeight: 320,
    });
  });

  it("양쪽 모두 부족하면 더 넓은 방향의 높이만 허용한다", () => {
    const placement = calculateAnchoredPopoverPlacement({
      anchor: { top: 170, right: 220, bottom: 194, left: 180 },
      viewport: { width: 800, height: 300 },
      preferredWidth: 320,
      contentHeight: 240,
      preferredMaxHeight: 320,
      gutter: 12,
      gap: 8,
    });

    expect(placement).toMatchObject({
      side: "above",
      top: 12,
      maxHeight: 150,
    });
  });
});
