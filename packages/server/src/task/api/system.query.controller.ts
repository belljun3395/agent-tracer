import { Controller, Get } from "@nestjs/common";
import { GetDefaultWorkspacePathUseCase } from "../application/get.default.workspace.path.usecase.js";
import { GetOverviewUseCase } from "../application/get.overview.usecase.js";

/**
 * Lives in task module because both endpoints query task-side data.
 * Path stays at /api/v1 (not /api/v1/tasks) for backward compatibility with web.
 */
@Controller("api/v1")
export class SystemQueryController {
    constructor(
        private readonly getOverview: GetOverviewUseCase,
        private readonly getDefaultWorkspacePath: GetDefaultWorkspacePathUseCase,
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
