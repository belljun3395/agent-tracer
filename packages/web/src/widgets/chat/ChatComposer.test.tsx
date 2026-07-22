import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatComposer } from "~web/widgets/chat/ChatComposer.js";

afterEach(cleanup);

function renderComposer() {
  const onSend = vi.fn();
  const onStop = vi.fn();
  render(<ChatComposer isStreaming={false} onSend={onSend} onStop={onStop} />);
  return { input: screen.getByLabelText("Message"), onSend };
}

describe("ChatComposer", () => {
  it("여러 줄을 입력하고 Enter로 전송한 뒤 포커스를 유지한다", () => {
    const { input, onSend } = renderComposer();
    fireEvent.change(input, { target: { value: "first\nsecond" } });

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith("first\nsecond");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("Shift+Enter는 전송하지 않고 줄바꿈 입력에 남겨 둔다", () => {
    const { input, onSend } = renderComposer();
    fireEvent.change(input, { target: { value: "first" } });

    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("한글 IME 조합 중 Enter는 전송으로 처리하지 않는다", () => {
    const { input, onSend } = renderComposer();
    fireEvent.change(input, { target: { value: "입력" } });
    fireEvent.compositionStart(input);

    fireEvent.keyDown(input, { key: "Enter", isComposing: true });

    expect(onSend).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("입력");
  });
});
