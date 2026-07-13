import { Inject, Injectable } from "@nestjs/common";
import { withDeadline } from "@monitor/platform";
import { READINESS_PROBE, type ReadinessProbe } from "~tracer-api/domain/health/port/readiness.probe.port.js";

const READINESS_PROBE_TIMEOUT_MS = 1_000;

@Injectable()
export class CheckReadinessUseCase {
    constructor(@Inject(READINESS_PROBE) private readonly probe: ReadinessProbe) {}

    async execute(): Promise<boolean> {
        try {
            await withDeadline(this.probe.pingDb(), READINESS_PROBE_TIMEOUT_MS, "tracer-db readiness probe");
            await withDeadline(this.probe.pingKafka(), READINESS_PROBE_TIMEOUT_MS, "kafka readiness probe");
            return true;
        } catch {
            return false;
        }
    }
}
