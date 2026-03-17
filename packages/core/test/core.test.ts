import { describe, expect, it } from "vitest";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  classifyEvent,
  createTaskSlug,
  normalizeWorkspacePath,
  normalizeLane,
  loadRulesIndex,
  tokenizeActionName
} from "../src/index.js";

describe("normalizeWorkspacePath", () => {
  it("compresses duplicate separators and trims trailing slash", () => {
    expect(normalizeWorkspacePath("/tmp//baden///")).toBe("/tmp/baden");
  });
});

describe("createTaskSlug", () => {
  it("creates a stable slug from a title", () => {
    expect(createTaskSlug({ title: "Build Baden Timeline MVP" })).toBe("build-baden-timeline-mvp");
  });
});

describe("loadRulesIndex", () => {
  it("loads yaml index entries and markdown references", () => {
    const rulesDir = fs.mkdtempSync(path.join(os.tmpdir(), "baden-rules-"));

    fs.writeFileSync(
      path.join(rulesDir, "INDEX.yaml"),
      [
        "version: 1",
        "rules:",
        "  - id: docs",
        "    title: Documentation",
        "    lane: file",
        "    prefixes: [\"docs/\"]",
        "    keywords: [\"readme\"]",
        "    tags: [\"docs\"]",
        "    file: docs.md"
      ].join("\n")
    );
    fs.writeFileSync(path.join(rulesDir, "docs.md"), "# Docs rule\n");

    const index = loadRulesIndex(rulesDir);

    expect(index.rules).toHaveLength(1);
    expect(index.rules[0]?.lane).toBe("exploration");
    expect(index.rules[0]?.markdown).toContain("Docs rule");
  });
});

describe("classifyEvent", () => {
  it("derives the lane from classifier matches when no explicit lane is provided", () => {
    const index = {
      version: 1,
      rules: [
        {
          id: "docs",
          title: "Documentation",
          lane: "exploration",
          prefixes: ["docs/"],
          keywords: ["readme"],
          tags: ["docs"]
        }
      ]
    } as const;

    const classification = classifyEvent(
      {
        kind: "tool.used",
        title: "Updated README references",
        filePaths: ["docs/tasks/003-backend-core.md"]
      },
      index
    );

    expect(classification.lane).toBe("exploration");
    expect(classification.tags).toContain("docs");
    expect(classification.matches[0]?.ruleId).toBe("docs");
  });

  it("classifies free-form snake_case actions with keyword overrides", () => {
    const classification = classifyEvent(
      {
        kind: "action.logged",
        actionName: "run_test_rule_guard",
        title: "run_test_rule_guard"
      },
      { version: 1, rules: [] }
    );

    expect(classification.lane).toBe("rules");
    expect(classification.tags).toContain("action-registry");
    expect(classification.matches[0]?.source).toBe("action-registry");
  });
});

describe("tokenizeActionName", () => {
  it("drops skip words like run_ before classification", () => {
    expect(tokenizeActionName("run_test_rule_guard")).toEqual(["test", "rule", "guard"]);
  });
});

// Additional test cases for tokenizeActionName
describe("tokenizeActionName - 추가 케이스", () => {
  it("camelCase를 토큰으로 분리한다", () => {
    expect(tokenizeActionName("readFileContent")).toEqual(["read", "file", "content"]);
  });

  it("앞의 run skip word를 제거한다", () => {
    expect(tokenizeActionName("run_tests")).toEqual(["tests"]);
  });

  it("빈 문자열은 빈 배열을 반환한다", () => {
    expect(tokenizeActionName("")).toEqual([]);
  });

  it("특수문자를 구분자로 처리한다", () => {
    expect(tokenizeActionName("read-file.content")).toEqual(["read", "file", "content"]);
  });

  it("모두 skip word면 빈 배열을 반환한다", () => {
    expect(tokenizeActionName("run")).toEqual([]);
  });
});

// Additional test cases for classifyEvent
describe("classifyEvent - 추가 케이스", () => {
  it("빈 규칙 인덱스에서도 기본 레인을 반환한다", () => {
    const result = classifyEvent(
      { kind: "tool.used", title: "read file" },
      { version: 1, rules: [] }
    );
    expect(result.lane).toBe("implementation");
    expect(result.matches).toHaveLength(0);
  });

  it("명시적 lane은 규칙 매치보다 우선한다", () => {
    const result = classifyEvent(
      { kind: "tool.used", title: "read", lane: "rules" },
      { version: 1, rules: [] }
    );
    expect(result.lane).toBe("rules");
  });
});

// Additional test cases for normalizeLane
describe("normalizeLane - 추가 케이스", () => {
  it("구버전 'file' → 'exploration'", () => {
    expect(normalizeLane("file")).toBe("exploration");
  });

  it("구버전 'terminal' → 'implementation'", () => {
    expect(normalizeLane("terminal")).toBe("implementation");
  });

  it("알 수 없는 값 → 'user'", () => {
    expect(normalizeLane("unknown-lane")).toBe("user");
  });

  it("현재 유효한 레인은 그대로 통과한다", () => {
    const lanes = ["user", "exploration", "planning", "implementation", "rules"] as const;
    for (const lane of lanes) {
      expect(normalizeLane(lane)).toBe(lane);
    }
  });
});
