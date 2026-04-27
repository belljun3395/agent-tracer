import { Inject, Injectable } from "@nestjs/common";
import { RUNTIME_BINDING_LOOKUP } from "~session/public/tokens.js";
import type { IRuntimeBindingLookup } from "~session/public/iservice/runtime.binding.lookup.iservice.js";
import type {
    IRuntimeBindingAccess,
    RuntimeBindingAccessRecord,
} from "../application/outbound/runtime.binding.access.port.js";

/**
 * Outbound adapter — bridges session module's public IRuntimeBindingLookup
 * to the task-local IRuntimeBindingAccess port.
 */
@Injectable()
export class RuntimeBindingAccessAdapter implements IRuntimeBindingAccess {
    constructor(
        @Inject(RUNTIME_BINDING_LOOKUP) private readonly inner: IRuntimeBindingLookup,
    ) {}

    async findLatestByTaskId(taskId: string): Promise<RuntimeBindingAccessRecord | null> {
        return this.inner.findLatestByTaskId(taskId);
    }
}
