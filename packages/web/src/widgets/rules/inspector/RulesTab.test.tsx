import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RuleId, TaskId } from "~web/shared/identity.js";
import type { RuleRecord } from "~web/entities/rule/model/rule.js";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { RulesTab } from "~web/widgets/rules/inspector/RulesTab.js";

const testState = vi.hoisted(() => ({
  enqueue: vi.fn(),
  reEvaluate: vi.fn(),
  refetchJob: vi.fn(),
  rules: [] as RuleRecord[],
  userInputs: [
    {
      eventId: "event-1",
      text: "first request",
      turnId: null,
      occurredAt: "2026-07-13T00:00:00.000Z",
    },
    {
      eventId: "event-2",
      text: "latest request",
      turnId: null,
      occurredAt: "2026-07-13T00:01:00.000Z",
    },
  ],
}));

vi.mock("~web/entities/rule/api/queries.js", () => ({
  useTaskRulesQuery: () => ({
    data: {
      rules: testState.rules,
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("~web/entities/task/api/detail-queries.js", () => ({
  useTaskDetailQuery: () => ({ data: { task: { status: "completed" } } }),
  useTaskUserInputsQuery: () => ({ data: testState.userInputs }),
}));

vi.mock("~web/entities/setting/api/queries.js", () => ({
  useAppSettingsQuery: () => ({
    data: {
      settings: [
        {
          key: "ruleGen.maxRulesPerTask",
          maskedValue: "3",
          updatedAt: "2026-07-13T00:00:00.000Z",
        },
      ],
    },
    isLoading: false,
  }),
}));

vi.mock("~web/entities/job/api/queries.js", () => ({
  useJobStatus: () => ({
    data: { job: null },
    refetch: testState.refetchJob,
  }),
}));

vi.mock("~web/entities/job/api/mutations.js", () => ({
  useEnqueueJob: () => ({ mutateAsync: testState.enqueue }),
}));

vi.mock("~web/entities/rule/api/mutations.js", () => ({
  useReEvaluateRuleMutation: () => ({
    mutateAsync: testState.reEvaluate,
    isPending: false,
  }),
}));

vi.mock("./RuleRow.js", () => ({
  RuleRow: ({ rule }: { readonly rule: RuleRecord }) => (
    <div data-testid={`rule-${rule.id}`}>{rule.name}</div>
  ),
}));

beforeEach(() => {
  testState.enqueue.mockReset();
  testState.enqueue.mockResolvedValue({});
  testState.reEvaluate.mockReset();
  testState.refetchJob.mockReset();
  testState.rules = [
    makeRule("rule-a", "Run tests", "event-2"),
    makeRule("rule-b", "Run lint", "event-2"),
  ];
});

afterEach(() => cleanup());

describe("RulesTab", () => {
  it("한 발화에서 나온 규칙 여럿을 모두 표시한다", () => {
    renderRulesTab();

    expect(screen.getByTestId("rule-rule-a").textContent).toBe("Run tests");
    expect(screen.getByTestId("rule-rule-b").textContent).toBe("Run lint");
  });

  it("최신 사용자 입력과 설정값을 규칙 생성 잡 입력으로 조합한다", async () => {
    renderRulesTab();

    fireEvent.change(
      screen.getByRole("textbox", { name: "Rule generation intent" }),
      { target: { value: "  Focus on deploy safety  " } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Generate rules" }));

    await waitFor(() =>
      expect(testState.enqueue).toHaveBeenCalledWith({
        taskId: TaskId("task-1"),
        intent: "Focus on deploy safety",
        maxRules: 3,
        anchorEventId: "event-2",
      }),
    );
  });
});

function renderRulesTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = createUiStore({ persisted: false });
  store.getState().setSelectedTaskId(TaskId("task-1"));

  return render(
    <QueryClientProvider client={queryClient}>
      <UiStoreProvider store={store}>
        <RulesTab />
      </UiStoreProvider>
    </QueryClientProvider>,
  );
}

function makeRule(
  id: string,
  name: string,
  anchorEventId: string,
): RuleRecord {
  return {
    id: RuleId(id),
    name,
    expect: { kind: "command", commandMatches: ["npm test"] },
    taskId: TaskId("task-1"),
    anchorEventId,
    citedTurnIds: [],
    citedEventIds: [],
    source: "human",
    severity: "warn",
    signature: `${id}-signature`,
    userEdited: false,
    reviewState: "active",
    lastEditedBy: "human",
    rev: 1,
    createdAt: "2026-07-13T00:00:00.000Z",
    verdictStatus: null,
    escalated: false,
  };
}
