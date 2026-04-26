import type { ITaskRepository } from "~application/ports/index.js";
import type { GetOverviewUseCaseIn, GetOverviewUseCaseOut } from "./dto/get.overview.usecase.dto.js";

export class GetOverviewUseCase {
    constructor(private readonly taskRepo: ITaskRepository) {}

    execute(_input: GetOverviewUseCaseIn): Promise<GetOverviewUseCaseOut> {
        return this.taskRepo.getOverviewStats();
    }
}
