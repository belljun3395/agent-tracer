import { Controller, Get, Inject } from "@nestjs/common";
import {
    GetOverviewUseCase,
    GetObservabilityOverviewUseCase,
    GetDefaultWorkspacePathUseCase,
} from "~application/index.js";
import { NoEnvelope } from "~main/presentation/decorators/index.js";

@Controller("health")
@NoEnvelope()
export class HealthController {
    // liveness probe; runtime checks server reachability, web checks connectivity
    @Get()
    health() {
        return { ok: true };
    }
}

@Controller("api/v1")
export class SystemQueryController {
    constructor(
        @Inject(GetOverviewUseCase) private readonly getOverview: GetOverviewUseCase,
        @Inject(GetObservabilityOverviewUseCase) private readonly getObservabilityOverview: GetObservabilityOverviewUseCase,
        @Inject(GetDefaultWorkspacePathUseCase) private readonly getDefaultWorkspacePath: GetDefaultWorkspacePathUseCase,
    ) {}

    @Get("overview")
    async overview() {
        const [stats, observability] = await Promise.all([
            this.getOverview.execute(),
            this.getObservabilityOverview.execute(),
        ]);
        return { stats, observability: observability.observability };
    }

    @Get("default/workspace")
    getDefaultWorkspaceEndpoint() {
        return { workspacePath: this.getDefaultWorkspacePath.execute() };
    }
}
