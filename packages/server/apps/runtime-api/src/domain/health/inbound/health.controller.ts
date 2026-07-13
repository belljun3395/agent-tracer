import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { CheckReadinessUseCase } from "~runtime-api/domain/health/application/check.readiness.usecase.js";
import { SkipGate } from "~runtime-api/support/skip-gate.decorator.js";

@Controller("health")
@SkipGate()
export class HealthController {
    constructor(private readonly readiness: CheckReadinessUseCase) {}

    @Get()
    health(): { readonly ok: true } {
        return { ok: true };
    }

    @Get("ready")
    async ready(): Promise<{ readonly ok: true }> {
        const ready = await this.readiness.execute();
        if (!ready) throw new ServiceUnavailableException({ ok: false });
        return { ok: true };
    }
}
