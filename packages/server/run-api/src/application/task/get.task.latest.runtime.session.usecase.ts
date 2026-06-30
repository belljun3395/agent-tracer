import { Injectable } from "@nestjs/common";
import { RuntimeBindingRepository } from "../../repository/session/runtime.binding.repository.js";
import type {
    GetTaskLatestRuntimeSessionUseCaseIn,
    GetTaskLatestRuntimeSessionUseCaseOut,
} from "./dto/get.task.latest.runtime.session.usecase.dto.js";

@Injectable()
export class GetTaskLatestRuntimeSessionUseCase {
    constructor(
        private readonly runtimeBindings: RuntimeBindingRepository,
    ) {}

    async execute(input: GetTaskLatestRuntimeSessionUseCaseIn): Promise<GetTaskLatestRuntimeSessionUseCaseOut> {
        return { runtimeSession: await this.runtimeBindings.findLatestByTaskId(input.taskId) };
    }
}
