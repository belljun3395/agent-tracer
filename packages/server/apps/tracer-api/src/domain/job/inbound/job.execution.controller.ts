import { Body, Controller, Headers, HttpCode, HttpStatus, NotFoundException, Param, Post } from "@nestjs/common";
import { MONITOR_LEASE_OWNER_HEADER, MONITOR_USER_HEADER } from "@monitor/kernel";
import { FailJobUseCase } from "~tracer-api/domain/job/application/command/fail.job.usecase.js";
import { ReleaseJobUseCase } from "~tracer-api/domain/job/application/command/release.job.usecase.js";
import { RenewJobLeaseUseCase } from "~tracer-api/domain/job/application/command/renew.job.lease.usecase.js";
import { StartJobUseCase } from "~tracer-api/domain/job/application/command/start.job.usecase.js";
import { SubmitJobResultsUseCase } from "~tracer-api/domain/job/application/command/submit.job.results.usecase.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { failBodySchema, resultsBodySchema, type FailBody, type ResultsBody } from "./job.execution.schema.js";

/** 잡 실행기의 리스·완료·실패 콜백 HTTP 계약을 제공한다. */
@Controller("api/v1/jobs")
export class JobExecutionController {
    constructor(
        private readonly startJob: StartJobUseCase,
        private readonly submitResults: SubmitJobResultsUseCase,
        private readonly failJob: FailJobUseCase,
        private readonly renewLease: RenewJobLeaseUseCase,
        private readonly releaseJob: ReleaseJobUseCase,
    ) {}

    @Post(":id/start")
    @HttpCode(HttpStatus.OK)
    async start(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Headers(MONITOR_LEASE_OWNER_HEADER) leaseOwner: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.startJob.execute(resolveUserId(user), id, leaseOwner);
    }

    @Post(":id/release")
    @HttpCode(HttpStatus.OK)
    async release(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Headers(MONITOR_LEASE_OWNER_HEADER) leaseOwner: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        if (leaseOwner === undefined) throw new NotFoundException("Job not found");
        return this.releaseJob.execute(resolveUserId(user), id, leaseOwner);
    }

    @Post(":id/lease")
    @HttpCode(HttpStatus.OK)
    async lease(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Headers(MONITOR_LEASE_OWNER_HEADER) leaseOwner: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        if (leaseOwner === undefined) throw new NotFoundException("Job not found");
        return this.renewLease.execute({
            userId: resolveUserId(user),
            id,
            leaseOwner,
            now: new Date(),
        });
    }

    @Post(":id/results")
    @HttpCode(HttpStatus.OK)
    async results(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(resultsBodySchema)) body: ResultsBody,
    ) {
        const usage = buildResultsUsage(body);
        return this.submitResults.execute({
            userId: resolveUserId(user),
            id,
            ...(body.proposals !== undefined ? { proposals: body.proposals } : {}),
            ...(body.result !== undefined ? { result: body.result } : {}),
            ...(usage !== undefined ? { usage } : {}),
        });
    }

    @Post(":id/fail")
    @HttpCode(HttpStatus.OK)
    async fail(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Headers(MONITOR_LEASE_OWNER_HEADER) leaseOwner: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(failBodySchema)) body: FailBody,
    ) {
        return this.failJob.execute(resolveUserId(user), id, body.error, leaseOwner);
    }
}

function buildResultsUsage(body: ResultsBody): Record<string, unknown> | undefined {
    const usage = { ...(body.usage ?? {}) };
    if (body.modelUsed !== undefined) usage["model"] = body.modelUsed;
    if (body.durationMs !== undefined) usage["durationMs"] = body.durationMs;
    if (body.costUsd !== undefined) usage["costUsd"] = body.costUsd;
    if (body.numTurns !== undefined) usage["numTurns"] = body.numTurns;
    return Object.keys(usage).length > 0 ? usage : undefined;
}
