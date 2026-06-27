import { Inject, Injectable } from "@nestjs/common";
import { RUNTIME_BINDING_ACCESS_PORT } from "./outbound/tokens.js";
import type { IRuntimeBindingAccess } from "./outbound/runtime.binding.access.port.js";
import type {
    GetTaskLatestRuntimeSessionUseCaseIn,
    GetTaskLatestRuntimeSessionUseCaseOut,
} from "./dto/get.task.latest.runtime.session.usecase.dto.js";

@Injectable()
export class GetTaskLatestRuntimeSessionUseCase {
    constructor(
        @Inject(RUNTIME_BINDING_ACCESS_PORT) private readonly runtimeBindings: IRuntimeBindingAccess,
    ) {}

    async execute(input: GetTaskLatestRuntimeSessionUseCaseIn): Promise<GetTaskLatestRuntimeSessionUseCaseOut> {
        return { runtimeSession: await this.runtimeBindings.findLatestByTaskId(input.taskId) };
    }
}
