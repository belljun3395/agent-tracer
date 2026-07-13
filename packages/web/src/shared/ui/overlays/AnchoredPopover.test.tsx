import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnchoredPopover } from "~web/shared/ui/overlays/AnchoredPopover.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AnchoredPopover", () => {
  it("document body에 고정 위치 포털을 렌더링한다", () => {
    mockPanelHeight(120);
    mockViewport(400, 640);
    mockAnchorRect({ top: 40, right: 310, bottom: 64, left: 286 });
    const anchorRef = createRef<HTMLButtonElement>();

    render(
      <>
        <button ref={anchorRef}>기준</button>
        <AnchoredPopover
          anchorRef={anchorRef}
          role="dialog"
          aria-label="테스트 팝오버"
          preferredWidth={240}
        >
          내용
        </AnchoredPopover>
      </>,
    );

    const popover = screen.getByRole("dialog", { name: "테스트 팝오버" });
    expect(popover.parentElement).toBe(document.body);
    expect(popover.classList.contains("fixed")).toBe(true);
    expect(popover.style.left).toBe("148px");
    expect(popover.style.top).toBe("72px");
    expect(popover.style.visibility).toBe("visible");
  });

  it("호출자가 포털 요소를 참조할 수 있게 전달한다", () => {
    mockPanelHeight(120);
    mockViewport(400, 640);
    mockAnchorRect({ top: 40, right: 120, bottom: 64, left: 96 });
    const anchorRef = createRef<HTMLButtonElement>();
    const popoverRef = createRef<HTMLDivElement>();

    render(
      <>
        <button ref={anchorRef}>기준</button>
        <AnchoredPopover
          ref={popoverRef}
          anchorRef={anchorRef}
          role="dialog"
          aria-label="참조 팝오버"
        >
          내용
        </AnchoredPopover>
      </>,
    );

    expect(popoverRef.current).toBe(
      screen.getByRole("dialog", { name: "참조 팝오버" }),
    );
  });

  it("앵커를 측정하기 전에는 안전한 숨김 위치를 사용한다", () => {
    mockViewport(320, 640);
    const anchorRef = createRef<HTMLElement>();

    render(
      <AnchoredPopover
        anchorRef={anchorRef}
        role="dialog"
        aria-label="숨김 팝오버"
        preferredWidth={520}
      >
        내용
      </AnchoredPopover>,
    );

    const popover = screen.getByRole("dialog", { hidden: true });
    expect(popover.getAttribute("aria-label")).toBe("숨김 팝오버");
    expect(popover.style.visibility).toBe("hidden");
    expect(popover.style.pointerEvents).toBe("none");
    expect(popover.style.width).toBe("296px");
  });

  it("capture scroll과 resize에서 앵커 위치를 다시 계산한다", () => {
    mockPanelHeight(120);
    mockViewport(800, 640);
    let anchorLeft = 100;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () =>
        makeRect({
          top: 40,
          right: anchorLeft + 24,
          bottom: 64,
          left: anchorLeft,
        }),
    );
    const anchorRef = createRef<HTMLButtonElement>();

    render(
      <>
        <button ref={anchorRef}>기준</button>
        <AnchoredPopover
          anchorRef={anchorRef}
          role="dialog"
          aria-label="이동 팝오버"
        >
          내용
        </AnchoredPopover>
      </>,
    );

    const popover = screen.getByRole("dialog", { name: "이동 팝오버" });
    expect(popover.style.left).toBe("100px");

    anchorLeft = 140;
    fireEvent.scroll(window);
    expect(popover.style.left).toBe("140px");

    anchorLeft = 180;
    fireEvent.resize(window);
    expect(popover.style.left).toBe("180px");
  });
});

function mockPanelHeight(height: number) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(height);
}

function mockViewport(width: number, height: number) {
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(width);
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(height);
}

function mockAnchorRect(bounds: {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    makeRect(bounds),
  );
}

function makeRect(bounds: {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}): DOMRect {
  return {
    ...bounds,
    x: bounds.left,
    y: bounds.top,
    width: bounds.right - bounds.left,
    height: bounds.bottom - bounds.top,
    toJSON: () => bounds,
  };
}
