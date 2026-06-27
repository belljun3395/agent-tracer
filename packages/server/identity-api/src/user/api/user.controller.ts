import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { ZodValidationPipe } from "@monitor/shared/contracts/http/zod-validation.pipe.js";
import { GetCurrentUserUseCase } from "../application/get.current.user.usecase.js";
import { OnboardUserUseCase } from "../application/onboard.user.usecase.js";

const onboardingSchema = z.object({
    email: z.string().trim().email(),
});

class OnboardingDto extends createZodDto(onboardingSchema) {}

@Controller("api/v1/users")
export class UserController {
    constructor(
        @Inject(OnboardUserUseCase) private readonly onboard: OnboardUserUseCase,
        @Inject(GetCurrentUserUseCase) private readonly currentUser: GetCurrentUserUseCase,
    ) {}

    @Post("onboarding")
    @HttpCode(HttpStatus.OK)
    async onboarding(@Body(new ZodValidationPipe(onboardingSchema)) body: OnboardingDto) {
        return this.onboard.execute({ email: body.email });
    }

    @Get("me")
    async me() {
        return this.currentUser.execute();
    }
}
