import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { RuleEvidenceEvent } from "~web/entities/rule/model/rule-evidence.js";
import { createUiStore, UiStoreProvider } from "~web/shared/store/index.js";
import { TooltipProvider } from "~web/shared/ui/index.js";
import { RuleEvidencePanel } from "~web/widgets/rules/evidence/RuleEvidencePanel.js";

describe("RuleEvidencePanel", () => {
  afterEach(cleanup);

  it("trigger와 action 흐름 요약을 evidence 목록보다 먼저 노출한다", () => {
    renderWithStore(
      <RuleEvidencePanel
        isLoading={false}
        isError={false}
        status="satisfied"
        anchored={false}
        triggers={[
          makeEvidence("trigger-1", "trigger", "사용자가 /rule을 언급했다"),
          makeEvidence("trigger-2", "trigger", "규칙 생성 요청"),
        ]}
        expects={[
          makeEvidence("action-1", "expect-fulfilled", "find 명령 실행", {
            command: "find . -path ./node_modules -prune -o -name '*.md'",
            toolName: "cmd",
          }),
        ]}
      />,
    );

    const flow = screen.getByLabelText("Rule evidence flow");

    expect(within(flow).getByText("TRIGGER")).not.toBeNull();
    expect(within(flow).getByText("2")).not.toBeNull();
    expect(within(flow).getByText("ACTION")).not.toBeNull();
    expect(within(flow).getByText("1")).not.toBeNull();
    expect(within(flow).getByText("FULFILLED")).not.toBeNull();
    expect(screen.getByText("TRIGGER EVENTS")).not.toBeNull();
    expect(screen.getByText("ACTION EVENTS")).not.toBeNull();
  });

  it("anchor된 규칙은 근거 입력과 미이행 판정을 드러낸다", () => {
    renderWithStore(
      <RuleEvidencePanel
        isLoading={false}
        isError={false}
        status="unmet"
        anchored
        triggers={[makeEvidence("anchor-1", "trigger", "lint 돌려줘")]}
        expects={[]}
      />,
    );

    const flow = screen.getByLabelText("Rule evidence flow");

    expect(within(flow).getByText("NOT FULFILLED")).not.toBeNull();
    expect(within(flow).getByText("INPUT")).not.toBeNull();
    expect(screen.getByText("SOURCE INPUT")).not.toBeNull();
  });

  it("파일과 일반 행동을 구분하고 증거를 선택한 이벤트로 이동한다", () => {
    const { store } = renderWithStore(
      <RuleEvidencePanel
        isLoading={false}
        isError={false}
        status="satisfied"
        anchored={false}
        triggers={[]}
        expects={[
          makeEvidence("file-1", "expect-fulfilled", "파일을 수정했다", {
            filePath: "src/policy.ts",
            toolName: "Write",
          }),
          makeEvidence("action-1", "expect-fulfilled", "테스트를 실행했다", {
            command: "npm test",
            toolName: "cmd",
          }),
        ]}
      />,
    );

    expect(screen.getByText("FILE ACTIONS")).not.toBeNull();
    expect(screen.getByText("ACTION EVENTS")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /src\/policy\.ts/ }));

    expect(store.getState().selectedEventId).toBe("file-1");
  });
});

function renderWithStore(children: ReactNode) {
  const store = createUiStore({ persisted: false });

  return {
    ...render(
      <UiStoreProvider store={store}>
        <TooltipProvider>{children}</TooltipProvider>
      </UiStoreProvider>,
    ),
    store,
  };
}

function makeEvidence(
  eventId: string,
  matchKind: RuleEvidenceEvent["matchKind"],
  title: string,
  extra: Partial<RuleEvidenceEvent> = {},
): RuleEvidenceEvent {
  return {
    eventId,
    kind: "message",
    title,
    decidedAt: "2026-07-07T07:18:00.000Z",
    createdAt: "2026-07-07T07:18:00.000Z",
    matchKind,
    matchedBy: matchKind === "trigger" ? ["trigger-phrase"] : ["action"],
    ...extra,
  };
}
