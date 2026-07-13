import type { LedgerProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";

export const TRACER_DATABASE = Symbol("TRACER_DATABASE");

/** 원장 투영의 트랜잭션 경계와 연결 수명주기를 제공한다. */
export interface TracerDatabase {
    initialize(): Promise<void>;
    destroy(): Promise<void>;
    ping(): Promise<void>;
    withTransaction<T>(work: (repositories: LedgerProjectionRepositories) => Promise<T>): Promise<T>;
}
