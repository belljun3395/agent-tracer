import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { RuleRecord } from "~web/entities/rule/model/rule.js";
import { RuleId, TaskId } from "~web/shared/identity.js";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { TooltipProvider } from "~web/shared/ui/index.js";
import { RuleListItem } from "~web/widgets/rules/RuleListItem.js";

vi.mock("~web/entities/rule/api/mutations.js", () => ({
  useApproveRuleMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useDeleteRuleMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));

afterEach(cleanup);

function makeRule(overrides: Partial<RuleRecord>): RuleRecord {
  return {
    id: RuleId("rule-a"),
    name: "npm run test 실행",
    expect: { kind: "command", commandMatches: ["npm run test"] },
    taskId: TaskId("task-1"),
    anchorEventId: "event-anchor",
    citedTurnIds: [],
    citedEventIds: [],
    source: "agent",
    severity: "block",
    signature: "rule-a-signature",
    userEdited: false,
    reviewState: "pendingReview",
    lastEditedBy: "agent",
    rev: 1,
    createdAt: "2026-07-13T00:00:00.000Z",
    verdictStatus: null,
    escalated: false,
    ...overrides,
  };
}

function renderItem(rule: RuleRecord) {
  const store = createUiStore({ persisted: false });
  render(
    <MemoryRouter>
      <UiStoreProvider store={store}>
        <TooltipProvider>
          <RuleListItem rule={rule} onEdit={vi.fn()} task={null} />
        </TooltipProvider>
      </UiStoreProvider>
    </MemoryRouter>,
  );
  return store;
}

describe("RuleListItem", () => {
  it("승인 대기 규칙은 인용한 턴과 이벤트를 보여준다", () => {
    renderItem(makeRule({ citedTurnIds: ["turn-7"], citedEventIds: ["event-42"] }));

    expect(screen.getByText("Cited turns")).not.toBeNull();
    expect(screen.getByText("turn-7")).not.toBeNull();
    expect(screen.getByText("Cited events")).not.toBeNull();
    expect(screen.getByText("event-42")).not.toBeNull();
  });

  it("인용한 이벤트를 누르면 타임라인 선택을 그 이벤트로 옮긴다", () => {
    const store = renderItem(makeRule({ citedEventIds: ["event-42"] }));

    fireEvent.click(screen.getByText("event-42"));

    expect(store.getState().selectedEventId).toBe("event-42");
  });

  it("발효된 규칙에서는 인용을 보여주지 않는다", () => {
    renderItem(makeRule({ reviewState: "active", citedEventIds: ["event-42"] }));

    expect(screen.queryByText("Cited events")).toBeNull();
    expect(screen.queryByText("event-42")).toBeNull();
  });
});
