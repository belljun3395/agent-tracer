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

  it("필드 그룹의 값을 태스크 범위 생성 입력으로 조합한다", () => {
    const taskId = TaskId("task-1");
    const onClose = vi.fn();
    const { container } = renderRuleForm("en", {
      defaultTaskId: taskId,
      defaultScope: "task",
      onClose,
    });

    fireEvent.change(screen.getByRole("textbox", { name: /Name/ }), {
      target: { value: "  Protect deploys  " },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Severity" }), {
      target: { value: "block" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /^Phrases/ }), {
      target: { value: "deploy\ndeploy\nverify" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /^Source/ }), {
      target: { value: "assistant" },
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
        trigger: { phrases: ["deploy", "verify"] },
        triggerOn: "assistant",
        expect: {
          kind: "pattern",
          pattern: "^safe",
          tool: "command",
        },
        scope: "task",
        taskId,
        severity: "block",
        rationale: "Require a safe deploy.",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );

    createMutate.mock.calls[0]?.[1].onSuccess();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("수정할 때 고정 범위를 보존하고 변경 가능한 값만 전송한다", () => {
    const onClose = vi.fn();
    const { container } = renderRuleForm("en", {
      rule: editableRule,
      onClose,
    });

    expect(screen.getByRole("combobox", { name: /^Scope/ })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: /Name/ }), {
      target: { value: "Updated rule" },
    });
    fireEvent.submit(requireForm(container));

    expect(updateMutate).toHaveBeenCalledWith(
      {
        ruleId: editableRule.id,
        body: {
          name: "Updated rule",
          trigger: { phrases: ["deploy"] },
          triggerOn: "user",
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
  readonly defaultTaskId?: TaskId;
  readonly defaultScope?: "global" | "task";
  readonly onClose?: () => void;
}

function renderRuleForm(locale: "en" | "ko", options: RenderRuleFormOptions = {}) {
  const store = createUiStore({ persisted: false });
  store.getState().setGuidanceLocale(locale);
  return render(
    <UiStoreProvider store={store}>
      <RuleForm
        {...(options.rule ? { rule: options.rule } : {})}
        {...(options.defaultTaskId ? { defaultTaskId: options.defaultTaskId } : {})}
        {...(options.defaultScope ? { defaultScope: options.defaultScope } : {})}
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
  trigger: { phrases: ["deploy"] },
  triggerOn: "user",
  expect: { kind: "command", commandMatches: ["migrate up"] },
  scope: "task",
  taskId: TaskId("task-1"),
  source: "human",
  severity: "warn",
  rationale: "Keep migrations explicit.",
  signature: "signature",
  userEdited: false,
  reviewState: "active",
  lastEditedBy: "human",
  rev: 1,
  createdAt: "2026-07-13T00:00:00.000Z",
};
