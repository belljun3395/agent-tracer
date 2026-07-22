import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { LiveToolActivity } from "~web/features/chat-send/useChatTurn.js";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { ChatToolCallChip } from "~web/widgets/chat/ChatToolCallChip.js";

afterEach(cleanup);

function renderChip(activity: LiveToolActivity) {
  return render(
    <UiStoreProvider store={createUiStore({ persisted: false })}>
      <ChatToolCallChip activity={activity} />
    </UiStoreProvider>,
  );
}

describe("ChatToolCallChip", () => {
  it("결과를 못 받은 도구는 이름과 함께 실행 중 상태를 보인다", () => {
    renderChip({ call: { id: "c1", name: "get_task", args: {} }, result: null });

    expect(screen.getByText("get_task")).not.toBeNull();
    expect(screen.getByText("Running")).not.toBeNull();
  });

  it("결과가 온 도구는 실행 중 라벨 없이 완료로 구분된다", () => {
    renderChip({
      call: { id: "c1", name: "get_task", args: {} },
      result: { toolCallId: "c1", toolName: "get_task", content: "ok" },
    });

    expect(screen.getByText("get_task")).not.toBeNull();
    expect(screen.queryByText("Running")).toBeNull();
  });
});
