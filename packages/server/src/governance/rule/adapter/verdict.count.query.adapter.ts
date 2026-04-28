import { Inject, Injectable } from "@nestjs/common";
import type { IVerdictCount } from "~governance/verification/public/iservice/verdict.count.iservice.js";
import { VERIFICATION_VERDICT_COUNT } from "~governance/verification/public/tokens.js";
import type {
    IVerdictCountQuery,
    VerdictCountResult,
} from "../application/outbound/verdict.count.query.port.js";

@Injectable()
export class VerdictCountQueryAdapter implements IVerdictCountQuery {
    constructor(
        @Inject(VERIFICATION_VERDICT_COUNT) private readonly inner: IVerdictCount,
    ) {}

    countForTask(taskId: string): Promise<VerdictCountResult> {
        return this.inner.countForTask(taskId);
    }
}
