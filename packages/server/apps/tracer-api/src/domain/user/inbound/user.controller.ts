import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import { GetCurrentUserUseCase } from "~tracer-api/domain/user/application/query/get.current.user.usecase.js";
import { OnboardUserUseCase } from "~tracer-api/domain/user/application/command/onboard.user.usecase.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { onboardingBodySchema, type OnboardingBody } from "./user.onboard.schema.js";

@Controller("api/v1/users")
export class UserController {
    constructor(
        private readonly getCurrentUser: GetCurrentUserUseCase,
        private readonly onboardUser: OnboardUserUseCase,
    ) {}

    @Get("me")
    async me(@Headers(MONITOR_USER_HEADER) user: string | undefined) {
        return this.getCurrentUser.execute(resolveUserId(user));
    }

    @Post("onboarding")
    @HttpCode(HttpStatus.OK)
    async onboarding(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(onboardingBodySchema)) body: OnboardingBody,
    ) {
        return this.onboardUser.execute(resolveUserId(user), body.email);
    }
}
