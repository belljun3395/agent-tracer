import { Inject, Injectable } from "@nestjs/common";
import { USER_REPOSITORY, type UserRepositoryPort } from "~tracer-api/domain/user/port/user.repository.port.js";

export interface CurrentUser {
    readonly userId: string;
    readonly email?: string;
}

@Injectable()
export class GetCurrentUserUseCase {
    constructor(
        @Inject(USER_REPOSITORY)
        private readonly users: UserRepositoryPort,
    ) {}

    async execute(userId: string): Promise<CurrentUser> {
        const user = await this.users.findById(userId);
        return user !== null ? { userId, email: user.email } : { userId };
    }
}
