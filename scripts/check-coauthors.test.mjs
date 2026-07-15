import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findDisallowedCoauthors } from "./check-coauthors.mjs";

describe("findDisallowedCoauthors", () => {
  it("공동 작성자가 없는 메시지를 통과시킨다", () => {
    assert.deepEqual(findDisallowedCoauthors("feat(kernel): 어휘를 세운다"), []);
  });

  it("허용 목록에 있는 트레일러를 통과시킨다", () => {
    const message = "feat(kernel): 어휘를 세운다\n\nCo-Authored-By: Claude <noreply@anthropic.com>";
    assert.deepEqual(findDisallowedCoauthors(message), []);
  });

  it("OmX 공동 작성자 트레일러를 통과시킨다", () => {
    const message = "feat(kernel): 어휘를 세운다\n\nCo-authored-by: OmX <omx@oh-my-codex.dev>";
    assert.deepEqual(findDisallowedCoauthors(message), []);
  });

  it("허용 목록에 없는 트레일러를 잡아낸다", () => {
    const message = "feat(kernel): 어휘를 세운다\n\nCo-authored-by: Tool <tool@example.com>";
    assert.deepEqual(findDisallowedCoauthors(message), [
      { name: "Tool", email: "tool@example.com" },
    ]);
  });

  it("여러 트레일러를 모두 잡아낸다", () => {
    const message = [
      "feat(kernel): 어휘를 세운다",
      "",
      "Co-authored-by: A <a@example.com>",
      "Co-authored-by: Claude <noreply@anthropic.com>",
      "Co-authored-by: B <b@example.com>",
    ].join("\n");
    assert.deepEqual(
      findDisallowedCoauthors(message).map((coauthor) => coauthor.email),
      ["a@example.com", "b@example.com"],
    );
  });
});
