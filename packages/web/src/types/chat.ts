/**
 * @module types/chat
 *
 * Chat UI 상태 타입 정의.
 * CLI 대화 인터페이스를 위한 프론트엔드 타입.
 */

/** 지원하는 CLI 타입 */
export type CliType = "claude" | "opencode";

/** 메시지 역할 */
export type MessageRole = "user" | "assistant" | "system";

/** 채팅 메시지 */
export interface ChatMessage {
  /** 메시지 ID (UUID) */
  readonly id: string;
  /** 역할 (user/assistant/system) */
  readonly role: MessageRole;
  /** 메시지 내용 */
  readonly content: string;
  /** 생성 시각 (ISO 8601) */
  readonly timestamp: string;
  /** 스트리밍 중 여부 */
  readonly isStreaming: boolean;
  /** 에러 메시지 (실패 시) */
  readonly error?: string;
}

/** 채팅 세션 상태 */
export type ChatSessionStatus =
  | "idle"        // 대기 중 (프로세스 없음)
  | "starting"    // 세션 시작 중
  | "running"     // 실행 중
  | "stopping"    // 종료 중
  | "error";      // 에러 발생

/** 채팅 세션 */
export interface ChatSession {
  /** 내부 세션 ID (프론트엔드 관리용) */
  readonly id: string;
  /** CLI 타입 */
  readonly cli: CliType;
  /** 작업 디렉토리 */
  readonly workdir: string;
  /** 사용할 모델 (provider/model 형식) */
  readonly model?: string;
  /** CLI 세션 ID (CLI 쪽 세션 식별자) */
  readonly cliSessionId?: string;
  /** CLI 프로세스 ID (실행 중인 프로세스 식별자) */
  readonly processId?: string;
  /** 연결된 agent-tracer task ID */
  readonly taskId?: string;
  /** 메시지 목록 */
  readonly messages: readonly ChatMessage[];
  /** 세션 상태 */
  readonly status: ChatSessionStatus;
  /** 생성 시각 */
  readonly createdAt: string;
  /** 마지막 활동 시각 */
  readonly lastActivityAt: string;
}

/** 전체 채팅 상태 */
export interface ChatState {
  /** 세션 목록 (Map: id -> session) */
  readonly sessions: ReadonlyMap<string, ChatSession>;
  /** 현재 활성 세션 ID */
  readonly activeSessionId: string | null;
  /** WebSocket 연결 상태 */
  readonly isConnected: boolean;
  /** 연결 에러 메시지 */
  readonly connectionError?: string;
}

/** 채팅 액션 타입 (reducer용) */
export type ChatAction =
  | { type: "CONNECT" }
  | { type: "DISCONNECT"; error?: string }
  | { type: "CREATE_SESSION"; session: ChatSession }
  | { type: "SET_ACTIVE_SESSION"; sessionId: string | null }
  | { type: "UPDATE_SESSION_STATUS"; sessionId: string; status: ChatSessionStatus; processId?: string; cliSessionId?: string; taskId?: string }
  | { type: "ADD_MESSAGE"; sessionId: string; message: ChatMessage }
  | { type: "UPDATE_MESSAGE"; sessionId: string; messageId: string; content: string; isStreaming?: boolean }
  | { type: "COMPLETE_MESSAGE"; sessionId: string; messageId: string }
  | { type: "ERROR_MESSAGE"; sessionId: string; messageId: string; error: string }
  | { type: "REMOVE_SESSION"; sessionId: string };

/** WebSocket 메시지 타입 (서버에서 수신) */
export interface CliWsMessage {
  readonly type: string;
  readonly requestId?: string;
  readonly processId?: string;
  readonly sessionId?: string;
  readonly event?: string;
  readonly content?: string;
  readonly exitCode?: number;
  readonly error?: string;
  readonly taskId?: string;
  readonly cli?: CliType;
  readonly metadata?: Record<string, unknown>;
}
