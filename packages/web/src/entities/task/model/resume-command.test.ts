import { describe, expect, it } from "vitest";
import type { ResumeTargetDto } from "@monitor/kernel";
import { buildResumeCommand } from "~web/entities/task/model/resume-command.js";

const target: ResumeTargetDto = {
  taskId: "task-1",
  runtimeSource: "claude-plugin",
  runtimeSessionId: "runtime-session-1",
  workspacePath: "/repo",
};

describe("buildResumeCommand", () => {
  it("Claude resume 명령을 런타임 세션 ID로 만든다", () => {
    expect(buildResumeCommand(target)).toBe(
      "cd '/repo' && claude --resume 'runtime-session-1'",
    );
  });

  it("Codex resume 명령을 런타임 세션 ID로 만든다", () => {
    expect(
      buildResumeCommand({
        ...target,
        runtimeSource: "codex-plugin",
        runtimeSessionId: "codex-session-1",
      }),
    ).toBe("cd '/repo' && codex resume 'codex-session-1'");
  });

  it("지원하지 않는 runtimeSource는 resume 명령을 만들지 않는다", () => {
    expect(() =>
      buildResumeCommand({
        ...target,
        runtimeSource: "shell",
      }),
    ).toThrow("unsupported runtimeSource");
  });
});
