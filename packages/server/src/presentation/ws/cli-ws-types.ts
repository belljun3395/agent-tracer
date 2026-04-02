/**
 * @module presentation/ws/cli-ws-types
 *
 * CLI WebSocket 메시지 타입 정의.
 * 클라이언트-서버 간 실시간 통신 프로토콜.
 */

import type { CliType } from "../../application/cli-bridge/types.js";

// ── 클라이언트 → 서버 메시지 ─────────────────────────────────────────────────

/** 새 CLI 세션 시작 요청 */
export interface CliStartMessage {
  readonly type: "cli:start";
  readonly cli: CliType;
  readonly workdir: string;
  readonly prompt: string;
  readonly requestId?: string;
  /** 연결할 agent-tracer task ID (선택) */
  readonly taskId?: string;
  /** 사용할 모델 (provider/model 형식) */
  readonly model?: string;
}

/** 기존 CLI 세션 재개 요청 */
export interface CliResumeMessage {
  readonly type: "cli:resume";
  readonly cli: CliType;
  readonly sessionId: string;
  readonly workdir: string;
  readonly prompt: string;
  readonly requestId?: string;
  /** 연결할 agent-tracer task ID (선택) */
  readonly taskId?: string;
  /** 사용할 모델 (provider/model 형식) */
  readonly model?: string;
}

/** CLI에 메시지 전송 */
export interface CliMessageMessage {
  readonly type: "cli:message";
  /** 프로세스 ID (cli:started 이벤트에서 수신) */
  readonly processId: string;
  readonly message: string;
}

/** CLI 프로세스 취소 요청 */
export interface CliCancelMessage {
  readonly type: "cli:cancel";
  /** 프로세스 ID */
  readonly processId: string;
}

/** 클라이언트 → 서버 메시지 Union */
export type CliClientMessage =
  | CliStartMessage
  | CliResumeMessage
  | CliMessageMessage
  | CliCancelMessage;

// ── 서버 → 클라이언트 메시지 ─────────────────────────────────────────────────

/** CLI 세션 시작됨 */
export interface CliStartedMessage {
  readonly type: "cli:started";
  readonly processId: string;
  readonly sessionId: string;
  readonly cli: CliType;
  readonly requestId?: string;
  /** 연결된 agent-tracer task ID */
  readonly taskId?: string;
}

/** CLI 스트리밍 응답 */
export interface CliStreamMessage {
  readonly type: "cli:stream";
  readonly processId: string;
  /** 스트림 이벤트 타입 */
  readonly event: string;
  /** 텍스트 내용 (delta인 경우) */
  readonly content?: string;
  /** 전체 메타데이터 */
  readonly metadata?: Record<string, unknown>;
}

/** CLI 세션 완료 */
export interface CliCompleteMessage {
  readonly type: "cli:complete";
  readonly processId: string;
  readonly sessionId: string;
  /** 종료 코드 */
  readonly exitCode: number;
}

/** CLI 에러 발생 */
export interface CliErrorMessage {
  readonly type: "cli:error";
  /** 프로세스 ID (시작 전 에러면 undefined) */
  readonly processId?: string;
  readonly requestId?: string;
  readonly error: string;
  readonly code?: string;
}

/** 서버 → 클라이언트 메시지 Union */
export type CliServerMessage =
  | CliStartedMessage
  | CliStreamMessage
  | CliCompleteMessage
  | CliErrorMessage;

// ── 타입 가드 ────────────────────────────────────────────────────────────────

export function isCliClientMessage(msg: unknown): msg is CliClientMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const { type } = msg as Record<string, unknown>;
  return (
    type === "cli:start" ||
    type === "cli:resume" ||
    type === "cli:message" ||
    type === "cli:cancel"
  );
}

export function isCliStartMessage(msg: CliClientMessage): msg is CliStartMessage {
  return msg.type === "cli:start";
}

export function isCliResumeMessage(msg: CliClientMessage): msg is CliResumeMessage {
  return msg.type === "cli:resume";
}

export function isCliMessageMessage(msg: CliClientMessage): msg is CliMessageMessage {
  return msg.type === "cli:message";
}

export function isCliCancelMessage(msg: CliClientMessage): msg is CliCancelMessage {
  return msg.type === "cli:cancel";
}
