/** 도구 호출 시작 시각을 훅 프로세스 사이에서 전달하는 저장소다. */
export interface ToolTimingPort {
    markStart(sessionId: string, toolUseId: string, startedAtMs: number): void;
    takeStart(sessionId: string, toolUseId: string): number | undefined;
}
