import type { RuntimeBindingReadPort } from "../ports/index.js";
import type { GetTaskLatestRuntimeSessionUseCaseIn, GetTaskLatestRuntimeSessionUseCaseOut } from "./dto/get.task.latest.runtime.session.usecase.dto.js";

export class GetTaskLatestRuntimeSessionUseCase {
    constructor(private readonly runtimeBindings: RuntimeBindingReadPort) {}
    async execute(input: GetTaskLatestRuntimeSessionUseCaseIn): Promise<GetTaskLatestRuntimeSessionUseCaseOut> {
        return { runtimeSession: await this.runtimeBindings.findLatestByTaskId(input.taskId) };
    }
}
