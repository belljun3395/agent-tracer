import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RuleMatchBadge } from "~web/widgets/rules/presentation/RuleMatchBadge.js";

describe("RuleMatchBadge", () => {
  it("매치 개수를 evidence 보조 라벨로 노출한다", () => {
    render(<RuleMatchBadge count={5} />);

    expect(screen.getByText("5 evidence")).not.toBeNull();
    expect(screen.queryByText("5 matches")).toBeNull();
  });
});
