/**
 * @module application/cli-bridge/types
 *
 * CLI 어댑터 타입 및 인터페이스 정의.
 * Claude Code, OpenCode CLI를 headless로 실행하기 위한 추상화 레이어.
 */

import type { Readable } from "node:stream";

/** 지원하는 CLI 타입 */
export type CliType = "claude" | "opencode";

/** CLI 세션 시작 옵션 */
export interface CliSessionOptions {
  /** CLI 타입 */
  readonly cli: CliType;
  /** 작업 디렉토리 (절대 경로) */
  readonly workdir: string;
  /** 초기 프롬프트 */
  readonly prompt: string;
  /** 연결할 agent-tracer task ID (선택) */
  readonly taskId?: string;
}

/** CLI 세션 재개 옵션 */
export interface CliResumeOptions {
  /** CLI 타입 */
  readonly cli: CliType;
  /** CLI 세션 ID (claude: conversation_id, opencode: session_id) */
  readonly sessionId: string;
  /** 작업 디렉토리 (절대 경로) */
  readonly workdir: string;
  /** 재개 시 전송할 프롬프트 */
  readonly prompt: string;
  /** 연결할 agent-tracer task ID (선택) */
  readonly taskId?: string;
}

/** 실행 중인 CLI 프로세스 핸들 */
export interface CliProcess {
  /** 프로세스 고유 ID (내부 관리용) */
  readonly processId: string;
  /** CLI 세션 ID (CLI별로 다름) */
  readonly sessionId: string;
  /** CLI 타입 */
  readonly cli: CliType;
  /** stdout 스트림 (JSON 라인 형식) */
  readonly stdout: Readable;
  /** 프로세스에 메시지 전송 */
  sendMessage(message: string): void;
  /** 프로세스 종료 */
  kill(): void;
  /** 프로세스 종료 대기 */
  wait(): Promise<number>;
}

/** CLI 어댑터 인터페이스 */
export interface CliAdapter {
  /** 어댑터 이름 (cli type과 동일) */
  readonly name: CliType;

  /**
   * 새 세션 시작
   * @param options 세션 옵션
   * @returns CLI 프로세스 핸들
   */
  startSession(options: Omit<CliSessionOptions, "cli">): Promise<CliProcess>;

  /**
   * 기존 세션 재개
   * @param options 재개 옵션
   * @returns CLI 프로세스 핸들
   */
  resumeSession(options: Omit<CliResumeOptions, "cli">): Promise<CliProcess>;
}

/** CLI 스트리밍 이벤트 타입 */
export type CliStreamEventType =
  | "message_start"
  | "content_block_start"
  | "content_block_delta"
  | "content_block_stop"
  | "message_delta"
  | "message_stop"
  | "result"
  | "error";

/** CLI 스트리밍 이벤트 (공통 형식) */
export interface CliStreamEvent {
  readonly type: CliStreamEventType;
  readonly content?: string;
  readonly sessionId?: string;
  readonly error?: string;
  readonly metadata?: Record<string, unknown>;
}
