import { Controller, Get, Inject } from "@nestjs/common";
import {
    GetDefaultWorkspacePathUseCase,
    GetOverviewUseCase,
} from "~application/tasks/index.js";

@Controller("api/v1")
export class SystemQueryController {
    constructor(
        @Inject(GetOverviewUseCase) private readonly getOverview: GetOverviewUseCase,
        @Inject(GetDefaultWorkspacePathUseCase) private readonly getDefaultWorkspacePath: GetDefaultWorkspacePathUseCase,
    ) {}

    @Get("overview")
    async overview() {
        const stats = await this.getOverview.execute({});
        return { stats };
    }

    @Get("default-workspace")
    getDefaultWorkspaceEndpoint() {
        return this.getDefaultWorkspacePath.execute({});
    }
}
