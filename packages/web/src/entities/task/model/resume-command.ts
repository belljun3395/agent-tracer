import type { ResumeTargetDto } from "@monitor/kernel";

/** 런타임 세션을 재개하는 셸 명령을 생성한다. */
export function buildResumeCommand(target: ResumeTargetDto): string {
  const command = buildRuntimeInvocation(target);
  return target.workspacePath
    ? `cd ${shellQuote(target.workspacePath)} && ${command}`
    : command;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function buildRuntimeInvocation(target: ResumeTargetDto): string {
  if (
    target.runtimeSource === "claude-plugin" ||
    target.runtimeSource === "claude-code"
  ) {
    return `claude --resume ${shellQuote(target.runtimeSessionId)}`;
  }
  if (target.runtimeSource === "codex-plugin") {
    return `codex resume ${shellQuote(target.runtimeSessionId)}`;
  }
  throw new Error(`unsupported runtimeSource: ${target.runtimeSource}`);
}
