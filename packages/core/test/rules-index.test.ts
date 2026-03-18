import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { classifyEvent, loadRulesIndex } from "@monitor/core";

function loadRepoRulesIndex() {
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(testDir, "../../..");
  return loadRulesIndex(path.join(repoRoot, "rules"));
}

describe("repo rules/INDEX.yaml", () => {
  it("does not classify generic checklist UI text as exploration", () => {
    const classification = classifyEvent(
      {
        kind: "tool.used",
        title: "Open checklist panel"
      },
      loadRepoRulesIndex()
    );

    expect(classification.lane).toBe("implementation");
    expect(classification.matches).toHaveLength(0);
  });

  it("does not tag backend work from a generic service word alone", () => {
    const classification = classifyEvent(
      {
        kind: "tool.used",
        title: "Update monitor-service implementation"
      },
      loadRepoRulesIndex()
    );

    expect(classification.matches.some((match) => match.ruleId === "server-runtime")).toBe(false);
    expect(classification.tags).not.toContain("backend");
  });

  it("does not route generic background status text into the background lane", () => {
    const classification = classifyEvent(
      {
        kind: "tool.used",
        title: "Background task completed"
      },
      loadRepoRulesIndex()
    );

    expect(classification.lane).toBe("implementation");
    expect(classification.matches.some((match) => match.ruleId === "background-lifecycle")).toBe(false);
  });

  it("routes runtime-specific async markers into the background lane", () => {
    const classification = classifyEvent(
      {
        kind: "tool.used",
        title: "run_in_background async_task_17 background_output"
      },
      loadRepoRulesIndex()
    );

    expect(classification.lane).toBe("background");
    expect(classification.matches.some((match) => match.ruleId === "background-lifecycle")).toBe(true);
  });

  it("covers coordination-specific monitoring surfaces", () => {
    const classification = classifyEvent(
      {
        kind: "tool.used",
        title: "Call monitor_task_link during delegation handoff"
      },
      loadRepoRulesIndex()
    );

    expect(classification.lane).toBe("coordination");
    expect(classification.matches.some((match) => match.ruleId === "coordination-surface")).toBe(true);
  });
});
