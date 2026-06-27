import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { NoEnvelope } from "@monitor/shared/contracts/http/no-envelope.decorator.js";

@Controller("health")
@NoEnvelope()
export class HealthController {
    constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

    /**
     * Liveness — is the process up? Deliberately checks no dependencies: a
     * transient Postgres/Redis blip must NOT make the orchestrator kill an
     * otherwise-healthy pod (that would turn a recoverable outage into a
     * crash loop). Use this for the liveness probe.
     */
    @Get()
    health() {
        return { ok: true };
    }

    /**
     * Readiness — is it safe to route traffic here? Verifies the Postgres
     * connection, since a dead pool is the worst case (every read/write fails).
     * Returns 503 on failure so the load balancer drains this pod until the
     * dependency recovers, then routes again once it reports ready. Use this
     * for the readiness probe.
     *
     * Only Postgres is checked today because it is the one client in the DI
     * container; Redis (owned by ws-gateway) and OpenSearch (owned by
     * timeline-api) can be folded in once they are exposed as providers.
     */
    @Get("ready")
    async ready(): Promise<{ readonly ok: true; readonly checks: Record<string, "up"> }> {
        const checks: Record<string, "up" | "down"> = {};
        try {
            await this.dataSource.query("SELECT 1");
            checks.postgres = "up";
        } catch {
            checks.postgres = "down";
        }

        const ready = Object.values(checks).every((status) => status === "up");
        if (!ready) {
            throw new ServiceUnavailableException({ ok: false, checks });
        }
        return { ok: true, checks: checks as Record<string, "up"> };
    }
}
