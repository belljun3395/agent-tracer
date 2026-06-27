import { Injectable } from "@nestjs/common";
import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import { UserRepository } from "../repository/user.repository.js";

export interface CurrentUserResult {
    readonly userId: string;
    readonly email?: string;
}

@Injectable()
export class GetCurrentUserUseCase {
    constructor(private readonly users: UserRepository) {}

    async execute(): Promise<CurrentUserResult> {
        const userId = currentUserId();
        const user = await this.users.findById(userId);
        return user ? { userId, email: user.email } : { userId };
    }
}
