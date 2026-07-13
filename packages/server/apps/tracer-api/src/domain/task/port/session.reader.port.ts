import type { SessionEntity } from "@monitor/tracer-domain";

export const SESSION_READER = Symbol("SessionReader");

/** 태스크에 속한 세션 조회를 제공하는 애플리케이션 포트다. */
export interface SessionReaderPort {
    findByTask(taskId: string): Promise<SessionEntity[]>;
}
