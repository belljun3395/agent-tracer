import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatThreadId } from "~web/shared/identity.js";
import { ChatThreadTitleEditor } from "./ChatThreadTitleEditor.js";

const mutate = vi.fn();
afterEach(cleanup);
vi.mock("~web/entities/chat/api/mutations.js", () => ({
  useRenameThreadMutation: () => ({ mutate, isPending: false }),
}));

describe("ChatThreadTitleEditor", () => {
  it("선택한 대화 제목을 인라인으로 저장한다", () => {
    render(
      <ChatThreadTitleEditor
        thread={{
          id: ChatThreadId("thread-1"),
          userId: "user-1",
          title: "기존 제목",
          summary: null,
          backend: null,
          createdAt: "2026-07-22T00:00:00.000Z",
          updatedAt: "2026-07-22T00:00:00.000Z",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rename conversation" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Conversation title" }), {
      target: { value: " 새 제목 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mutate).toHaveBeenCalledWith("새 제목", expect.any(Object));
  });

  it("같은 대화의 제목 prop이 바뀌면 최신 제목으로 편집한다", () => {
    const thread = {
      id: ChatThreadId("thread-1"), userId: "user-1", title: "New conversation",
      summary: null, backend: null, createdAt: "2026-07-22T00:00:00.000Z", updatedAt: "2026-07-22T00:00:00.000Z",
    } as const;
    const rendered = render(<ChatThreadTitleEditor thread={thread} />);
    rendered.rerender(<ChatThreadTitleEditor thread={{ ...thread, title: "자동 생성 제목" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Rename conversation" }));
    expect(screen.getByRole("textbox", { name: "Conversation title" })).toHaveValue("자동 생성 제목");
  });
});
