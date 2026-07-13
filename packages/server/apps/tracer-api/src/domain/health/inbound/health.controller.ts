import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { CheckReadinessUseCase } from "~tracer-api/domain/health/application/query/check.readiness.usecase.js";
import { NoEnvelope } from "~tracer-api/support/no-envelope.decorator.js";
import { SkipGate } from "~tracer-api/support/skip-gate.decorator.js";

/** 인증을 켜도 컨테이너 프로브가 신원 없이 접근할 수 있는 헬스체크 HTTP 계약이다. */
@SkipGate()
@Controller("health")
export class HealthController {
    constructor(private readonly readiness: CheckReadinessUseCase) {}

    @Get()
    @NoEnvelope()
    health(): { readonly status: "ok" } {
        return { status: "ok" };
    }

    @Get("ready")
    @NoEnvelope()
    async ready(): Promise<{ readonly status: "ok" }> {
        const ready = await this.readiness.execute();
        if (!ready) throw new ServiceUnavailableException({ status: "unavailable" });
        return { status: "ok" };
    }
}
