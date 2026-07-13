import type { ResumeTargetDto } from "@monitor/kernel";
import { buildResumeCommand } from "~web/entities/task/model/resume-command.js";

const DEFAULT_RESUME_HELPER_BASE_URL = "http://127.0.0.1:3848";
const RESUME_TOKEN_HEADER = "x-agent-tracer-resume-token";

export type ResumeOpenStatus = "opened" | "copied";

export interface ResumeOpenResult {
  readonly status: ResumeOpenStatus;
  readonly command: string;
}

export interface ResumeOpenOptions {
  readonly helperBaseUrl?: string;
  readonly token?: string;
}

/** 로컬 helper로 세션을 열고 실패하면 같은 명령을 클립보드에 복사한다. */
export async function openResumeSession(
  target: ResumeTargetDto,
  options: ResumeOpenOptions = {},
): Promise<ResumeOpenResult> {
  const command = buildResumeCommand(target);
  const helperBaseUrl = normalizeBaseUrl(
    options.helperBaseUrl ?? resolveResumeHelperBaseUrl(),
  );
  const token = options.token ?? resolveResumeHelperToken();

  try {
    const response = await fetch(`${helperBaseUrl}/api/v1/resume`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { [RESUME_TOKEN_HEADER]: token } : {}),
      },
      body: JSON.stringify(target),
    });
    if (response.ok && isResumeHelperSuccess(await readJson(response))) {
      return { status: "opened", command };
    }
  } catch {
    // helper 접속 실패는 사용자가 직접 실행할 수 있는 명령 복사로 복구한다.
  }

  await navigator.clipboard.writeText(command);
  return { status: "copied", command };
}

function resolveResumeHelperBaseUrl(): string {
  return (
    (import.meta.env.VITE_AGENT_TRACER_RESUME_BASE_URL as string | undefined) ??
    DEFAULT_RESUME_HELPER_BASE_URL
  );
}

function resolveResumeHelperToken(): string | undefined {
  return import.meta.env.VITE_AGENT_TRACER_RESUME_TOKEN as string | undefined;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/g, "");
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

function isResumeHelperSuccess(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>)["ok"] === true
  );
}
