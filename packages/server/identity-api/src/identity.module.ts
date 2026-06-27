import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserController } from "./user.controller.js";
import { UserEntity } from "./user.entity.js";
import { UserRepository } from "./user.repository.js";
import { OnboardUserUseCase } from "./onboard.user.usecase.js";
import { GetCurrentUserUseCase } from "./get.current.user.usecase.js";

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity])],
    controllers: [UserController],
    providers: [UserRepository, OnboardUserUseCase, GetCurrentUserUseCase],
})
export class IdentityModule {}
