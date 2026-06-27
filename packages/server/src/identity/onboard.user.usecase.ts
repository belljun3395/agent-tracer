import { Injectable } from "@nestjs/common";
import { deriveUserId } from "~shared/user/user.identity.js";
import { UserRepository } from "./user.repository.js";

export interface OnboardUserResult {
    readonly userId: string;
    readonly email: string;
}

/**
 * 최초 사용 시 이메일을 받아 안정적 userId 로 변환하고 기록한다(멱등).
 * 이후 클라이언트는 이 userId 를 X-User-Id 헤더로 보낸다.
 */
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
