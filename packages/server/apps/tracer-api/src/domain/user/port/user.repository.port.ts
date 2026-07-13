import type { UserEntity } from "@monitor/tracer-domain";

export const USER_REPOSITORY = Symbol("UserRepository");

/** 사용자 애그리게이트의 조회와 저장을 제공하는 애플리케이션 포트다. */
export interface UserRepositoryPort {
    findById(userId: string): Promise<UserEntity | null>;
    upsert(user: UserEntity): Promise<void>;
}
