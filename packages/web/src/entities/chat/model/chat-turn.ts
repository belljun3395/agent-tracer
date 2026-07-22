import type {
  ChatBackend,
  ChatConfirmationRecord,
  ChatToolCall,
} from "~web/entities/chat/model/chat.js";

/** 모델이 이번 턴에 제안한 도구 호출이며, tool_call SSE 프레임의 데이터다. */
export type ChatTurnToolCall = ChatToolCall;

/** 도구가 이번 턴에 낸 결과이며, toolCallId로 어느 호출의 결과인지 잇는다. */
export interface ChatTurnToolResult {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly content: string;
}

/** 쓰기 도구가 실행 대신 세운 승인 요청 한 건이며, id는 이 요청을 해소할 확인 식별자다. */
export type ChatConfirmRequest = ChatConfirmationRecord;

/** remember_fact가 즉시 적재한 기억을 사용자에게 투명하게 알리는 갱신 통지다. */
export interface ChatMemoryUpdate {
  readonly key: string;
  readonly content: string;
}

/** done SSE 프레임이 싣는, 이번 턴 실행의 요약이다. */
export interface ChatTurnSummary {
  readonly text: string;
  readonly backend: ChatBackend;
  readonly toolCalls: readonly ChatTurnToolCall[];
  readonly modelUsed: string;
  readonly costUsd: number | null;
  readonly numTurns: number | null;
  readonly errorSummary: string | null;
}
