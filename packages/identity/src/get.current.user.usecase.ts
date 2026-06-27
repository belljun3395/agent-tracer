import { Injectable } from "@nestjs/common";
import { currentUserId } from "@monitor/shared-kernel/user/user.context.js";
import { UserRepository } from "./user.repository.js";

export interface CurrentUserResult {
    readonly userId: string;
    readonly email?: string;
}

/** 현재 요청의 사용자 정보를 반환한다(온보딩 기록이 있으면 이메일 포함). */
@Injectable()
export class GetCurrentUserUseCase {
    constructor(private readonly users: UserRepository) {}

    async execute(): Promise<CurrentUserResult> {
        const userId = currentUserId();
        const user = await this.users.findById(userId);
        return user ? { userId, email: user.email } : { userId };
    }
}
