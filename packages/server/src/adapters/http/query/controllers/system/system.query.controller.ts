import { Controller, Get, Inject } from "@nestjs/common";
import {
    GetDefaultWorkspacePathUseCase,
    GetObservabilityOverviewUseCase,
    GetOverviewUseCase,
} from "~application/index.js";

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
            this.getOverview.execute({}),
            this.getObservabilityOverview.execute({}),
        ]);
        return { stats, observability: observability.observability };
    }

    @Get("default-workspace")
    getDefaultWorkspaceEndpoint() {
        return this.getDefaultWorkspacePath.execute({});
    }
}
