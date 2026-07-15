import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuleRecord } from "~web/entities/rule/model/rule.js";
import { RuleId, TaskId } from "~web/shared/identity.js";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { TooltipProvider } from "~web/shared/ui/index.js";
import { RuleRow } from "~web/widgets/rules/inspector/RuleRow.js";

const testState = vi.hoisted(() => ({
  evidence: {
    status: "unmet",
    anchorEventId: "event-1",
    triggers: [
      {
        eventId: "event-1",
        kind: "message",
        title: "lint 돌려줘",
        decidedAt: "2026-07-13T00:00:00.000Z",
        createdAt: "2026-07-13T00:00:00.000Z",
        matchKind: "trigger",
        matchedBy: ["trigger-phrase"],
        unfulfilled: true,
      },
    ],
    expects: [] as unknown[],
  },
}));

vi.mock("~web/entities/rule/api/mutations.js", () => ({
  useReEvaluateRuleMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useDeleteRuleMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));

vi.mock("~web/entities/rule/api/queries.js", () => ({
  useRuleEvidenceQuery: () => ({
    data: testState.evidence,
    isLoading: false,
    isError: false,
  }),
}));

afterEach(cleanup);

beforeEach(() => {
  testState.evidence.status = "unmet";
});

describe("RuleRow", () => {
  it("접힌 카드가 증거 개수가 아니라 이행 여부를 말한다", () => {
    renderRow(makeRule({ verdictStatus: "satisfied", matchCount: 2 }));

    expect(screen.getByText("FULFILLED")).not.toBeNull();
    expect(screen.queryByText("2 evidence")).toBeNull();
  });

  it("판정이 열린 적 없으면 이행 여부를 주장하지 않는다", () => {
    renderRow(makeRule({ verdictStatus: null }));

    expect(screen.getByText("NOT EVALUATED")).not.toBeNull();
  });

  it("증거가 없는 미이행 규칙도 펼쳐서 이유를 볼 수 있다", () => {
    renderRow(makeRule({ verdictStatus: "unmet", matchCount: 0 }));

    const toggle = screen.getByRole("button", { name: "Expand rule evidence" });
    fireEvent.click(toggle);

    expect(screen.getByLabelText("Rule evidence flow")).not.toBeNull();
    expect(screen.getByText("SOURCE INPUT")).not.toBeNull();
  });

  it("판정도 증거도 없는 규칙은 펼칠 것이 없다", () => {
    renderRow(makeRule({ verdictStatus: null, matchCount: 0 }));

    expect(screen.queryByRole("button", { name: "Expand rule evidence" })).toBeNull();
  });
});

function renderRow(rule: RuleRecord) {
  const store = createUiStore({ persisted: false });
  return render(
    <UiStoreProvider store={store}>
      <TooltipProvider>
        <RuleRow rule={rule} contextTaskId={TaskId("task-1")} onEdit={vi.fn()} />
      </TooltipProvider>
    </UiStoreProvider>,
  );
}

function makeRule(overrides: Partial<RuleRecord>): RuleRecord {
  return {
    id: RuleId("rule-a"),
    name: "npm run lint:deps 실행",
    expect: { kind: "command", commandMatches: ["npm run lint:deps"] },
    taskId: TaskId("task-1"),
    anchorEventId: "event-1",
    citedTurnIds: [],
    citedEventIds: [],
    source: "agent",
    severity: "warn",
    signature: "rule-a-signature",
    userEdited: false,
    reviewState: "active",
    lastEditedBy: "agent",
    rev: 1,
    createdAt: "2026-07-13T00:00:00.000Z",
    verdictStatus: null,
    escalated: false,
    ...overrides,
  };
}
