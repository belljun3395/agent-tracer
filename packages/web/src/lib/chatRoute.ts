import type { CliType } from "../types/chat.js";

export interface ResumeChatContext {
  readonly taskId: string;
  readonly sessionId: string;
  readonly workdir: string;
  readonly runtimeSource?: string | undefined;
}

export interface NewChatContext {
  readonly cli: CliType;
  readonly workdir: string;
  readonly taskId?: string;
  readonly model?: string;
}

export function inferCliTypeFromRuntimeSource(runtimeSource?: string): CliType {
  return runtimeSource?.includes("opencode") ? "opencode" : "claude";
}

function buildChatHref(params: URLSearchParams): string {
  return `/chat?${params.toString()}`;
}

export function buildNewChatHref(context: NewChatContext): string {
  const params = new URLSearchParams({
    open: "1",
    cli: context.cli,
    workdir: context.workdir
  });
  if (context.model) {
    params.set("model", context.model);
  }
  if (context.taskId) {
    params.set("taskId", context.taskId);
  }
  return buildChatHref(params);
}

export function buildResumeChatHref(context: ResumeChatContext): string {
  const params = new URLSearchParams({
    open: "1",
    cli: inferCliTypeFromRuntimeSource(context.runtimeSource),
    workdir: context.workdir,
    taskId: context.taskId,
    sessionId: context.sessionId
  });
  return buildChatHref(params);
}
