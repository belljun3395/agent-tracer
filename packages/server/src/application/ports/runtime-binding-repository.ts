/**
 * @module application/ports/runtime-binding-repository
 *
 * 런타임 세션 바인딩 저장소 포트.
 * runtimeSource + runtimeSessionId 쌍을 taskId/sessionId로 매핑.
 * runtimeSource는 opaque string — 서버가 런타임 이름으로 분기하지 않는다.
 */

export interface RuntimeBinding {
  readonly runtimeSource: string;
  readonly runtimeSessionId: string;
  readonly taskId: string;
  readonly monitorSessionId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RuntimeBindingUpsertInput {
  readonly runtimeSource: string;
  readonly runtimeSessionId: string;
  readonly taskId: string;
  readonly monitorSessionId: string;
}

export interface IRuntimeBindingRepository {
  upsert(input: RuntimeBindingUpsertInput): Promise<RuntimeBinding>;
  /** Active binding — only returns when monitor_session_id is set. */
  find(runtimeSource: string, runtimeSessionId: string): Promise<RuntimeBinding | null>;
  /** Returns taskId for any binding (active or session-cleared). */
  findTaskId(runtimeSource: string, runtimeSessionId: string): Promise<string | null>;
  /** Returns the most recent runtimeSource + runtimeSessionId for a task (any status). */
  findLatestByTaskId(taskId: string): Promise<{ runtimeSource: string; runtimeSessionId: string } | null>;
  /** Clears monitor_session_id to NULL, preserving the task association. */
  clearSession(runtimeSource: string, runtimeSessionId: string): Promise<void>;
  delete(runtimeSource: string, runtimeSessionId: string): Promise<void>;
}
