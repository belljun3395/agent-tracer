import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tooltip, TooltipProvider } from "~web/shared/ui/overlays/Tooltip.js";

describe("Tooltip", () => {
  it("모달 위와 단축키 오버레이 아래 레이어에 표시한다", async () => {
    render(
      <TooltipProvider>
        <Tooltip content="도움말" delayMs={0}>
          <button type="button">열기</button>
        </Tooltip>
      </TooltipProvider>,
    );

    fireEvent.pointerMove(screen.getByRole("button", { name: "열기" }));

    await waitFor(() => {
      expect(screen.getByRole("tooltip").parentElement?.classList.contains("z-[1050]"))
        .toBe(true);
    });
  });
});
