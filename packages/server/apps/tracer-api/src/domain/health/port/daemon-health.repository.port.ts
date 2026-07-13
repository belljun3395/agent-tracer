import type { DaemonHealthEntity } from "@monitor/tracer-domain";

export const DAEMON_HEALTH_REPOSITORY = Symbol("DaemonHealthRepository");

/** 데몬 건강 보고의 조회와 저장을 제공하는 애플리케이션 포트다. */
export interface DaemonHealthRepositoryPort {
    findByUser(userId: string): Promise<DaemonHealthEntity | null>;
    upsert(entity: DaemonHealthEntity): Promise<void>;
}
