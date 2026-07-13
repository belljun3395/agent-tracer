import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as UiStateModule from "~web/shared/store/index.js";
import { InspectTab } from "~web/widgets/inspector/tabs/inspect/InspectTab.js";

const fixture = vi.hoisted(() => ({
  taskId: "task-1",
  eventId: "event-1",
  detail: {
    task: {},
    timeline: [
      {
        id: "event-1",
        taskId: "task-1",
        turnId: "turn-1",
        kind: "execute_tool",
        lane: "implementation",
        title: "테스트를 실행했다",
        metadata: {},
        classification: { lane: "implementation", tags: [] },
        createdAt: "2026-07-10T09:20:00.000Z",
      },
    ],
  },
  verifications: [
    {
      id: "verification-1",
      taskId: "task-1",
      ruleId: "rule-1",
      ruleName: "변경 후 테스트 실행",
      turnId: "turn-1",
      evaluatedAt: "2026-07-10T09:30:00.000Z",
      matchedEventIds: ["event-1"],
    },
  ],
}));

vi.mock("~web/entities/task/api/detail-queries.js", () => ({
  useTaskDetailQuery: () => ({ data: fixture.detail }),
  useTaskVerificationsQuery: () => ({ data: fixture.verifications }),
  useTaskChildrenQuery: () => ({ data: { tasks: [] } }),
}));

vi.mock("~web/shared/store/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof UiStateModule>();
  return {
    ...actual,
    useSelectedTaskId: () => fixture.taskId,
    useSelectedEventId: () => fixture.eventId,
  };
});

describe("InspectTab", () => {
  it("원본 이벤트 payload와 그 이벤트를 검증한 규칙을 함께 표시한다", () => {
    render(
      <UiStateModule.UiStoreProvider
        store={UiStateModule.createUiStore({ persisted: false })}
      >
        <InspectTab />
      </UiStateModule.UiStoreProvider>,
    );

    expect(screen.getByRole("heading", { name: "테스트를 실행했다" })).not.toBeNull();
    expect(screen.getByText("변경 후 테스트 실행")).not.toBeNull();
  });
});
