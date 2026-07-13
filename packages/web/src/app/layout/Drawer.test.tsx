import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Drawer } from "~web/app/layout/Drawer.js";

describe("Drawer", () => {
  it("요청 폭이 커도 현재 뷰포트 너비를 넘지 않는다", () => {
    render(
      <Drawer side="right" width={600} label="Inspector" onDismiss={vi.fn()}>
        내용
      </Drawer>,
    );

    const dialog = screen.getByRole("dialog", { name: "Inspector" });
    const panel = dialog.lastElementChild;

    expect(panel).not.toBeNull();
    expect((panel as HTMLElement).style.width).toBe("600px");
    expect((panel as HTMLElement).style.maxWidth).toBe("100vw");
  });
});
