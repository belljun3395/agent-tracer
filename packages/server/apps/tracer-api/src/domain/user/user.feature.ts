import { UserRepository } from "@monitor/tracer-domain";
import { OnboardUserUseCase } from "~tracer-api/domain/user/application/command/onboard.user.usecase.js";
import { GetCurrentUserUseCase } from "~tracer-api/domain/user/application/query/get.current.user.usecase.js";
import { UserController } from "~tracer-api/domain/user/inbound/user.controller.js";
import { USER_REPOSITORY } from "~tracer-api/domain/user/port/user.repository.port.js";

/** user 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const userFeature = {
    controllers: [UserController],
    providers: [
        OnboardUserUseCase,
        GetCurrentUserUseCase,
        { provide: USER_REPOSITORY, useExisting: UserRepository },
    ],
};
