import { Injectable } from "@nestjs/common";
import { deriveUserId } from "@monitor/shared/kernel/user/user.identity.js";
import { UserRepository } from "../repository/user.repository.js";

export interface OnboardUserResult {
    readonly userId: string;
    readonly email: string;
}

@Injectable()
export class OnboardUserUseCase {
    constructor(private readonly users: UserRepository) {}

    async execute(input: { readonly email: string }): Promise<OnboardUserResult> {
        const email = input.email.trim().toLowerCase();
        const userId = deriveUserId(email);
        const user = await this.users.upsert(userId, email, new Date().toISOString());
        return { userId: user.userId, email: user.email };
    }
}
