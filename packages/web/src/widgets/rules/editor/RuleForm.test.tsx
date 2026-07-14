import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RuleId, TaskId } from "~web/shared/identity.js";
import type { RuleRecord } from "~web/entities/rule/model/rule.js";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { RuleForm } from "~web/widgets/rules/editor/RuleForm.js";

const { createMutate, updateMutate } = vi.hoisted(() => ({
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
}));

vi.mock("~web/entities/rule/api/mutations.js", () => ({
  useCreateRuleMutation: () => ({
    mutate: createMutate,
    isPending: false,
  }),
  useUpdateRuleMutation: () => ({
    mutate: updateMutate,
    isPending: false,
  }),
}));

vi.mock("~web/entities/task/api/detail-queries.js", () => ({
  useTaskUserInputsQuery: () => ({
    data: [
      { eventId: "event-1", text: "deploy 전에 테스트 돌려줘" },
      { eventId: "event-2", text: "린트도 돌려줘" },
    ],
  }),
}));

const TASK_ID = TaskId("task-1");

afterEach(() => cleanup());

beforeEach(() => {
  createMutate.mockReset();
  updateMutate.mockReset();
});

describe("RuleForm", () => {
  it("이름 검증 안내를 선택한 설명 언어로 표시한다", () => {
    const { container } = renderRuleForm("ko");

    fireEvent.submit(requireForm(container));

    const error = screen.getByText("규칙 이름을 입력하세요.");
    expect(error.getAttribute("lang")).toBe("ko");
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("기대 동작 검증 안내를 선택한 설명 언어로 표시한다", () => {
    const { container } = renderRuleForm("ko");
    fireEvent.change(screen.getByRole("textbox", { name: /Name/ }), {
      target: { value: "Verify tests" },
    });

    fireEvent.submit(requireForm(container));

    const error = screen.getByText(
      "선택한 Kind가 요구하는 필드를 채우세요.",
    );
    expect(error.getAttribute("lang")).toBe("ko");
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("검증할 사용자 발화를 고르지 않으면 생성하지 않는다", () => {
    const { container } = renderRuleForm("ko");
    fireEvent.change(screen.getByRole("textbox", { name: /Name/ }), {
      target: { value: "Verify tests" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /^Kind/ }), {
      target: { value: "action" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /^Tool name/ }), {
      target: { value: "command" },
    });

    fireEvent.submit(requireForm(container));

    const error = screen.getByText("규칙이 검증할 사용자 발화를 고르세요.");
    expect(error.getAttribute("lang")).toBe("ko");
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("필드 그룹의 값을 생성 입력으로 조합한다", () => {
    const onClose = vi.fn();
    const { container } = renderRuleForm("en", { onClose });

    fireEvent.change(screen.getByRole("textbox", { name: /Name/ }), {
      target: { value: "  Protect deploys  " },
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: "User input this rule verifies" }),
      { target: { value: "event-2" } },
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Severity" }), {
      target: { value: "block" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /^Kind/ }), {
      target: { value: "pattern" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /^Tool name/ }), {
      target: { value: "command" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /^Pattern/ }), {
      target: { value: "  ^safe  " },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /^Rationale/ }), {
      target: { value: "  Require a safe deploy.  " },
    });

    fireEvent.submit(requireForm(container));

    expect(createMutate).toHaveBeenCalledWith(
      {
        name: "Protect deploys",
        expect: {
          kind: "pattern",
          pattern: "^safe",
          tool: "command",
        },
        taskId: TASK_ID,
        anchorEventId: "event-2",
        severity: "block",
        rationale: "Require a safe deploy.",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );

    createMutate.mock.calls[0]?.[1].onSuccess();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("수정할 때 검증 대상 발화를 고정하고 변경 가능한 값만 전송한다", () => {
    const onClose = vi.fn();
    const { container } = renderRuleForm("en", {
      rule: editableRule,
      onClose,
    });

    expect(
      screen.getByRole("combobox", { name: "User input this rule verifies" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: /Name/ }), {
      target: { value: "Updated rule" },
    });
    fireEvent.submit(requireForm(container));

    expect(updateMutate).toHaveBeenCalledWith(
      {
        ruleId: editableRule.id,
        body: {
          name: "Updated rule",
          expect: {
            kind: "command",
            commandMatches: ["migrate up"],
          },
          severity: "warn",
          rationale: "Keep migrations explicit.",
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});

interface RenderRuleFormOptions {
  readonly rule?: RuleRecord;
  readonly onClose?: () => void;
}

function renderRuleForm(locale: "en" | "ko", options: RenderRuleFormOptions = {}) {
  const store = createUiStore({ persisted: false });
  store.getState().setGuidanceLocale(locale);
  return render(
    <UiStoreProvider store={store}>
      <RuleForm
        {...(options.rule ? { rule: options.rule } : {})}
        taskId={TASK_ID}
        onClose={options.onClose ?? vi.fn()}
      />
    </UiStoreProvider>,
  );
}

function requireForm(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector("form");
  if (form === null) throw new Error("RuleForm을 찾을 수 없습니다.");
  return form;
}

const editableRule: RuleRecord = {
  id: RuleId("rule-1"),
  name: "Migration rule",
  expect: { kind: "command", commandMatches: ["migrate up"] },
  taskId: TASK_ID,
  anchorEventId: "event-1",
  source: "human",
  severity: "warn",
  rationale: "Keep migrations explicit.",
  signature: "signature",
  userEdited: false,
  reviewState: "active",
  lastEditedBy: "human",
  rev: 1,
  createdAt: "2026-07-13T00:00:00.000Z",
  verdictStatus: null,
  escalated: false,
};
