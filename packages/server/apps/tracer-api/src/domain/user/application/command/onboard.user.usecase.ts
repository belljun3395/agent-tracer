import { Inject, Injectable } from "@nestjs/common";
import { UserEntity } from "@monitor/tracer-domain";
import { USER_REPOSITORY, type UserRepositoryPort } from "~tracer-api/domain/user/port/user.repository.port.js";

export interface OnboardResult {
    readonly userId: string;
    readonly email: string;
}

@Injectable()
export class OnboardUserUseCase {
    constructor(
        @Inject(USER_REPOSITORY)
        private readonly users: UserRepositoryPort,
    ) {}

    async execute(userId: string, email: string): Promise<OnboardResult> {
        const normalized = email.trim().toLowerCase();
        const user = UserEntity.register(userId, normalized, new Date());
        await this.users.upsert(user);
        return { userId: user.userId, email: user.email };
    }
}
