import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TaskVerification } from "~web/entities/task/model/timeline/verification.js";
import { EventVerificationSection } from "~web/widgets/inspector/tabs/inspect/EventVerificationSection.js";

describe("EventVerificationSection", () => {
  it("선택한 이벤트를 검증한 모든 규칙을 한 번씩 표시한다", () => {
    render(
      <EventVerificationSection
        entry={{
          moveToVeri: true,
          verifications: [
            makeVerification("verification-1", "파일 수정 후 테스트"),
            makeVerification("verification-2", "린트 통과"),
          ],
        }}
      />,
    );

    expect(screen.getByText("Verified by")).not.toBeNull();
    expect(screen.getByText("2 rules")).not.toBeNull();
    expect(screen.getByText("파일 수정 후 테스트")).not.toBeNull();
    expect(screen.getByText("린트 통과")).not.toBeNull();
  });

  it("부재 조건의 기준 이벤트임을 검증 규칙과 함께 알린다", () => {
    render(
      <EventVerificationSection
        entry={{
          moveToVeri: false,
          verifications: [makeVerification("verification-1", "금지 명령 미사용")],
        }}
      />,
    );

    expect(screen.getByText("1 rule")).not.toBeNull();
    expect(screen.getByText("Absence check anchor")).not.toBeNull();
    expect(screen.getByText("금지 명령 미사용")).not.toBeNull();
  });
});

function makeVerification(id: string, ruleName: string): TaskVerification {
  return {
    id,
    taskId: "task-1",
    ruleId: `rule-${id}`,
    ruleName,
    turnId: "turn-1",
    evaluatedAt: "2026-07-10T09:30:00.000Z",
    matchedEventIds: ["event-1"],
  };
}
