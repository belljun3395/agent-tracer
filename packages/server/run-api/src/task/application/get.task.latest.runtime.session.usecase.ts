import { Inject, Injectable } from "@nestjs/common";
import { RUNTIME_BINDING_LOOKUP } from "@monitor/run-api/session/public/tokens.js";
import type { IRuntimeBindingLookup } from "@monitor/run-api/session/public/iservice/runtime.binding.lookup.iservice.js";
import type {
    GetTaskLatestRuntimeSessionUseCaseIn,
    GetTaskLatestRuntimeSessionUseCaseOut,
} from "./dto/get.task.latest.runtime.session.usecase.dto.js";

@Injectable()
export class GetTaskLatestRuntimeSessionUseCase {
    constructor(
        @Inject(RUNTIME_BINDING_LOOKUP) private readonly runtimeBindings: IRuntimeBindingLookup,
    ) {}

    async execute(input: GetTaskLatestRuntimeSessionUseCaseIn): Promise<GetTaskLatestRuntimeSessionUseCaseOut> {
        return { runtimeSession: await this.runtimeBindings.findLatestByTaskId(input.taskId) };
    }
}
