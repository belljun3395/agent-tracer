import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  KO_GUIDANCE,
  createGuidanceMessage,
  guidanceCode,
  guidanceStrong,
} from "~web/shared/guidance.js";
import { GuidanceText } from "~web/shared/GuidanceText.js";

describe("GuidanceText", () => {
  it("선택한 locale과 구조화된 의미 요소를 가장 가까운 컨테이너에 렌더링한다", () => {
    const message = createGuidanceMessage(
      guidanceStrong("주의"),
      ": ",
      guidanceCode("npm run lint"),
      " 명령을 확인하세요.",
    );
    const { container } = render(
      <GuidanceText as="p" locale="ko" message={message} />,
    );
    const guidance = container.querySelector("p");

    expect(guidance?.getAttribute("lang")).toBe("ko");
    expect(guidance?.textContent).toBe("주의: npm run lint 명령을 확인하세요.");
    expect(guidance?.querySelector("strong")?.textContent).toBe("주의");
    expect(guidance?.querySelector("code")?.textContent).toBe("npm run lint");
  });

  it("기술 토큰을 HTML로 해석하지 않고 catalog 순서 그대로 표시한다", () => {
    const message = KO_GUIDANCE.common.runCommandToContinue("<script>");
    const { container } = render(
      <GuidanceText locale="ko" message={message} />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.firstElementChild?.textContent).toBe(
      "계속하려면 <script> 명령을 실행하세요.",
    );
    expect(container.querySelector("code")?.textContent).toBe("<script>");
  });
});
