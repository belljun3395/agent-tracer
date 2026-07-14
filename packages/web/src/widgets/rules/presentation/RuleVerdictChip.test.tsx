import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RuleVerdictChip } from "~web/widgets/rules/presentation/RuleVerdictChip.js";

describe("RuleVerdictChip", () => {
  afterEach(cleanup);

  it("이행된 규칙과 미이행 규칙을 다른 라벨로 가른다", () => {
    render(<RuleVerdictChip status="satisfied" />);
    expect(screen.getByText("FULFILLED")).not.toBeNull();

    cleanup();
    render(<RuleVerdictChip status="unmet" />);
    expect(screen.getByText("NOT FULFILLED")).not.toBeNull();
  });

  it("아직 이행되지 않은 규칙과 판정을 단언할 수 없는 규칙을 가른다", () => {
    render(<RuleVerdictChip status="open" />);
    expect(screen.getByText("NOT YET")).not.toBeNull();

    cleanup();
    render(<RuleVerdictChip status="unknown" />);
    expect(screen.getByText("CANNOT VERIFY")).not.toBeNull();
  });

  it("판정이 열린 적 없으면 이행 여부를 주장하지 않는다", () => {
    render(<RuleVerdictChip status={null} />);
    expect(screen.getByText("NOT EVALUATED")).not.toBeNull();
  });
});
