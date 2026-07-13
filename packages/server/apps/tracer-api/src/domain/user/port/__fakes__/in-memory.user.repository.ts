import type { UserEntity } from "@monitor/tracer-domain";
import type { UserRepositoryPort } from "~tracer-api/domain/user/port/user.repository.port.js";

/** 사용자 저장소 포트의 인메모리 대역이다. */
export class InMemoryUserRepository implements UserRepositoryPort {
    private readonly rows = new Map<string, UserEntity>();

    seed(...users: readonly UserEntity[]): void {
        for (const user of users) this.rows.set(user.userId, user);
    }

    all(): readonly UserEntity[] {
        return [...this.rows.values()];
    }

    findById(userId: string): Promise<UserEntity | null> {
        return Promise.resolve(this.rows.get(userId) ?? null);
    }

    upsert(user: UserEntity): Promise<void> {
        this.rows.set(user.userId, user);
        return Promise.resolve();
    }
}
