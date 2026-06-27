import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserController } from "./user.controller.js";
import { UserEntity } from "./user.entity.js";
import { UserRepository } from "./user.repository.js";
import { OnboardUserUseCase } from "./onboard.user.usecase.js";
import { GetCurrentUserUseCase } from "./get.current.user.usecase.js";

/**
 * 식별 모듈 — 이메일 온보딩과 현재 사용자 조회를 담당한다.
 * 멀티유저 신원은 요청 헤더(X-User-Id / X-User-Email)로 전파되고, 이 모듈은
 * 이메일↔userId 매핑을 기록한다.
 */
@Module({
    imports: [TypeOrmModule.forFeature([UserEntity])],
    controllers: [UserController],
    providers: [UserRepository, OnboardUserUseCase, GetCurrentUserUseCase],
})
export class IdentityModule {}
