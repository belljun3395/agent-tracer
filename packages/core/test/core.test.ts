import { describe, expect, it } from "vitest";

import {
  buildOpenInferenceTaskExport,
  buildWorkflowContext,
  buildReusableTaskSnapshot,
  classifyEvent,
  createTaskSlug,
  normalizeWorkspacePath,
  normalizeLane,
  tokenizeActionName
} from "@monitor/core";

describe("normalizeWorkspacePath", () => {
  it("compresses duplicate separators and trims trailing slash", () => {
    expect(normalizeWorkspacePath("/tmp//baden///")).toBe("/tmp/baden");
  });
});

describe("buildReusableTaskSnapshot", () => {
  it("preserves full assistant and planning text while keeping search text indexed", () => {
    const longSummary = "[README.md](/Users/example/project/README.md) 다시 읽었습니다. 현재 기준 핵심은 Agent Tracer를 다른 프로젝트에 붙여 쓰는 monitor server/MCP/hook/plugin 소스로 두는 쪽이 1차 목표라는 점이고, 외부 프로젝트용 실행 경로는 `npm install && npm run build && npm run dev:server`입니다.";
    const longDecision = "README refresh summary: README re-read complete. Key points: Agent Tracer is positioned primarily as an external-project integration via monitor server/MCP/hooks/plugins.";
    const snapshot = buildReusableTaskSnapshot({
      objective: "README.md 한번 다시 읽어봐.",
      events: [
        {
          id: "user-1",
          taskId: "task-1",
          kind: "user.message",
          lane: "user",
          title: "사용자 요청",
          body: "README.md 한번 다시 읽어봐.",
          metadata: {},
          classification: { lane: "user", tags: [], matches: [] },
          createdAt: "2026-03-28T00:00:00.000Z"
        },
        {
          id: "plan-1",
          taskId: "task-1",
          kind: "context.saved",
          lane: "planning",
          title: "README refresh summary",
          body: longDecision,
          metadata: {},
          classification: { lane: "planning", tags: [], matches: [] },
          createdAt: "2026-03-28T00:00:01.000Z"
        },
        {
          id: "assistant-1",
          taskId: "task-1",
          kind: "assistant.response",
          lane: "user",
          title: "README reread summary",
          body: longSummary,
          metadata: {},
          classification: { lane: "user", tags: [], matches: [] },
          createdAt: "2026-03-28T00:00:02.000Z"
        }
      ]
    });

    expect(snapshot.outcomeSummary).toBe(longSummary);
    expect(snapshot.keyDecisions).toContain(`README refresh summary: ${longDecision}`);
    expect(snapshot.searchText).toContain("npm install && npm run build && npm run dev:server");
  });

});

describe("buildOpenInferenceTaskExport", () => {
  it("maps timeline events into OpenInference-aligned span records", () => {
    const exportPayload = buildOpenInferenceTaskExport(
      {
        id: "task-1",
        title: "Inspect task",
        slug: "inspect-task",
        status: "running",
        taskKind: "primary",
        runtimeSource: "codex-cli",
        createdAt: "2026-03-28T00:00:00.000Z",
        updatedAt: "2026-03-28T00:00:01.000Z"
      },
      [
        {
          id: "evt-1",
          taskId: "task-1",
          kind: "tool.used",
          lane: "implementation",
          title: "Read file",
          metadata: { toolName: "Read", filePaths: ["README.md"] },
          classification: { lane: "implementation", tags: [], matches: [] },
          createdAt: "2026-03-28T00:00:01.000Z"
        }
      ]
    );

    expect(exportPayload.runtimeSource).toBe("codex-cli");
    expect(exportPayload.spans[0]).toMatchObject({
      spanId: "evt-1",
      kind: "TOOL"
    });
    expect(exportPayload.spans[0]?.attributes["tool.name"]).toBe("Read");
    expect(exportPayload.spans[0]?.attributes["gen_ai.system"]).toBe("openai");
  });
});

describe("buildWorkflowContext", () => {
  it("includes passive rule audit and evidence snapshot sections", () => {
    const context = buildWorkflowContext(
      [
        {
          id: "task-1",
          taskId: "task-1",
          kind: "task.start",
          lane: "planning",
          title: "Codex run",
          metadata: { runtimeSource: "codex-cli" },
          classification: { lane: "planning", tags: [], matches: [] },
          createdAt: "2026-04-08T00:00:00.000Z"
        },
        {
          id: "user-1",
          taskId: "task-1",
          kind: "user.message",
          lane: "user",
          title: "Start",
          body: "규칙을 확인해줘",
          metadata: { source: "codex-skill", captureMode: "raw" },
          classification: { lane: "user", tags: [], matches: [] },
          createdAt: "2026-04-08T00:00:01.000Z"
        },
        {
          id: "rule-1",
          taskId: "task-1",
          kind: "rule.logged",
          lane: "implementation",
          title: "Rule violation: missing doc read",
          metadata: {
            ruleId: "doc-read-first",
            ruleStatus: "violation",
            severity: "high",
            rulePolicy: "block",
            ruleOutcome: "blocked"
          },
          classification: { lane: "implementation", tags: [], matches: [] },
          createdAt: "2026-04-08T00:00:02.000Z"
        },
        {
          id: "rule-2",
          taskId: "task-1",
          kind: "rule.logged",
          lane: "implementation",
          title: "Rule pass: doc read recorded",
          metadata: {
            ruleId: "doc-read-first",
            ruleStatus: "pass",
            rulePolicy: "approval_required",
            ruleOutcome: "approved"
          },
          classification: { lane: "implementation", tags: [], matches: [] },
          createdAt: "2026-04-08T00:00:03.000Z"
        }
      ],
      "Rule audit task"
    );

    expect(context).toContain("## Rule Audit");
    expect(context).toContain("`doc-read-first` (high · policy:approval_required · outcome:approved) — 1 violation · 1 pass · 0 check");
    expect(context).toContain("## Evidence Snapshot");
    expect(context).toContain("Default posture: self-reported");
    expect(context).toContain("Tool and shell activity: self-reported");
    expect(context).toContain("## Rule Enforcement Snapshot");
    expect(context).toContain("Rule enforcement: 2 decisions (1 blocked, 1 approved)");
  });
});

describe("createTaskSlug", () => {
  it("creates a stable slug from a title", () => {
    expect(createTaskSlug({ title: "Build Baden Timeline MVP" })).toBe("build-baden-timeline-mvp");
  });
});

describe("classifyEvent", () => {
  it("derives the lane from action-registry match", () => {
    const classification = classifyEvent({
      kind: "tool.used",
      actionName: "readFile"
    });

    expect(classification.lane).toBe("exploration");
    expect(classification.tags).toContain("action-registry");
  });

  it("classifies free-form snake_case actions with keyword overrides", () => {
    const classification = classifyEvent({
      kind: "action.logged",
      actionName: "run_test_rule_guard",
      title: "run_test_rule_guard"
    });

    expect(classification.lane).toBe("implementation");
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
  it("액션 없을 때 기본 레인을 반환한다", () => {
    const result = classifyEvent(
      { kind: "tool.used", title: "read file" }
    );
    expect(result.lane).toBe("implementation");
    expect(result.matches).toHaveLength(0);
  });

  it("명시적 lane은 action-registry 매치보다 우선한다", () => {
    const result = classifyEvent(
      { kind: "tool.used", title: "read", lane: "implementation" }
    );
    expect(result.lane).toBe("implementation");
  });

  it("user.message는 action-registry 매치가 있어도 user 레인을 유지한다", () => {
    const result = classifyEvent({
      kind: "user.message",
      title: "Discuss opencode async background behavior",
      body: "Need to review background lifecycle"
    });

    expect(result.lane).toBe("user");
  });

  it("task.start도 user 레인을 유지한다", () => {
    const result = classifyEvent({
      kind: "task.start",
      title: "OpenCode background task"
    });

    expect(result.lane).toBe("user");
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

  it("구버전 'rules' → 'implementation' (backward compat)", () => {
    expect(normalizeLane("rules")).toBe("implementation");
  });

  it("알 수 없는 값 → 'user'", () => {
    expect(normalizeLane("unknown-lane")).toBe("user");
  });

  it("현재 유효한 레인은 그대로 통과한다", () => {
    const lanes = ["user", "exploration", "planning", "implementation"] as const;
    for (const lane of lanes) {
      expect(normalizeLane(lane)).toBe(lane);
    }
  });
});
