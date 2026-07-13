import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "~web/shared/ui/overlays/Tooltip.js";
import { StatusDot } from "~web/shared/ui/display/StatusDot.js";

describe("StatusDot", () => {
  it("UI 상태 공급자 없이 순수 표시 요소를 렌더링한다", () => {
    render(<StatusDot status="running" tooltip={false} />);

    expect(screen.getByLabelText("status: running")).toBeTruthy();
  });

  it("소비자가 주입한 상태 설명으로 툴팁 트리거를 렌더링한다", () => {
    render(
      <TooltipProvider>
        <StatusDot status="waiting" tooltipContent="Waiting for input" />
      </TooltipProvider>,
    );

    expect(screen.getByLabelText("status: waiting")).toBeTruthy();
  });
});
