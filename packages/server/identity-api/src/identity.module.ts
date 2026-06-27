import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserController } from "./user/api/user.controller.js";
import { UserEntity } from "./user/domain/user.entity.js";
import { UserRepository } from "./user/repository/user.repository.js";
import { OnboardUserUseCase } from "./user/application/onboard.user.usecase.js";
import { GetCurrentUserUseCase } from "./user/application/get.current.user.usecase.js";

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity])],
    controllers: [UserController],
    providers: [UserRepository, OnboardUserUseCase, GetCurrentUserUseCase],
})
export class IdentityModule {}
