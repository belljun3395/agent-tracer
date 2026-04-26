import { Controller, Get, Inject } from "@nestjs/common";
import { GetObservabilityOverviewUseCase } from "~application/index.js";

@Controller("api/v1/observability")
export class ObservabilityQueryController {
    constructor(
        @Inject(GetObservabilityOverviewUseCase) private readonly getObservabilityOverview: GetObservabilityOverviewUseCase,
    ) {}

    @Get("overview")
    async overview() {
        return this.getObservabilityOverview.execute({});
    }
}
