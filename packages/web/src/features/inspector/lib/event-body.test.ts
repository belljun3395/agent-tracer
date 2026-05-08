import { describe, expect, it } from "vitest";
import { splitBodySegments } from "./event-body.js";

describe("splitBodySegments", () => {
  it("returns a single text segment for plain prose", () => {
    expect(splitBodySegments("Just a sentence.")).toEqual([
      { kind: "text", text: "Just a sentence." },
    ]);
  });

  it("returns [] for empty / whitespace-only input", () => {
    expect(splitBodySegments("")).toEqual([]);
    expect(splitBodySegments("   \n   ")).toEqual([]);
  });

  it("extracts a fenced block surrounded by prose", () => {
    const body = "Before\n```ts\nconst x = 1;\n```\nAfter";
    expect(splitBodySegments(body)).toEqual([
      { kind: "text", text: "Before" },
      { kind: "code", text: "const x = 1;", lang: "ts" },
      { kind: "text", text: "After" },
    ]);
  });

  it("handles multiple code blocks", () => {
    const body = "```\nfoo\n```\nmiddle\n```js\nbar\n```";
    expect(splitBodySegments(body)).toEqual([
      { kind: "code", text: "foo" },
      { kind: "text", text: "middle" },
      { kind: "code", text: "bar", lang: "js" },
    ]);
  });

  it("preserves blank-language fences without a `lang` field", () => {
    const result = splitBodySegments("```\nplain\n```");
    expect(result).toEqual([{ kind: "code", text: "plain" }]);
  });
});
