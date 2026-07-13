import type { ResumeTargetDto, SessionDto } from "@monitor/kernel";
import type { TaskDetailResponse } from "~web/entities/task/model/task-query.js";

const SUPPORTED_RESUME_RUNTIME_SOURCES = new Set([
  "claude-code",
  "claude-plugin",
  "codex-plugin",
]);

export function selectResumeTarget(
  detail: TaskDetailResponse,
): ResumeTargetDto | null {
  if (detail.resumeTarget && isSupportedRuntimeSource(detail.resumeTarget.runtimeSource)) {
    return detail.resumeTarget;
  }
  const session = detail.sessions?.find(hasRuntimeSessionId);
  if (!session) return null;
  return {
    taskId: detail.task.id,
    runtimeSource: session.runtimeSource,
    runtimeSessionId: session.runtimeSessionId,
    ...(detail.task.workspacePath
      ? { workspacePath: detail.task.workspacePath }
      : {}),
  };
}

function hasRuntimeSessionId(session: SessionDto): boolean {
  return (
    session.runtimeSessionId.trim().length > 0 &&
    isSupportedRuntimeSource(session.runtimeSource)
  );
}

function isSupportedRuntimeSource(value: string): boolean {
  return SUPPORTED_RESUME_RUNTIME_SOURCES.has(value);
}
