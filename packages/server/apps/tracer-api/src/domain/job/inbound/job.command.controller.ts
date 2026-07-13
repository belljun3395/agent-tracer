import { Body, Controller, Headers, HttpCode, HttpStatus, NotFoundException, Param, Post } from "@nestjs/common";
import { JOB_FEEDBACK_KIND, MONITOR_USER_HEADER } from "@monitor/kernel";
import { CancelJobUseCase } from "~tracer-api/domain/job/application/command/cancel.job.usecase.js";
import { EnqueueJobUseCase } from "~tracer-api/domain/job/application/command/enqueue.job.usecase.js";
import {
    SubmitJobFeedbackUseCase,
    type SubmitJobFeedbackInput,
} from "~tracer-api/domain/job/application/command/submit.job.feedback.usecase.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import {
    enqueueBodySchema,
    feedbackBodySchema,
    type EnqueueBody,
    type FeedbackBody,
} from "./job.command.schema.js";

/** 사용자 잡 생성·취소·피드백 HTTP 계약을 제공한다. */
@Controller("api/v1/jobs")
export class JobCommandController {
    constructor(
        private readonly enqueueJob: EnqueueJobUseCase,
        private readonly cancelJob: CancelJobUseCase,
        private readonly submitFeedback: SubmitJobFeedbackUseCase,
    ) {}

    @Post()
    @HttpCode(HttpStatus.ACCEPTED)
    async enqueue(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(enqueueBodySchema)) body: EnqueueBody,
    ) {
        return this.enqueueJob.execute(
            resolveUserId(user),
            body.kind,
            body.input ?? {},
            {
                ...(body.idempotencyKey !== undefined ? { idempotencyKey: body.idempotencyKey } : {}),
                ...(body.agentBackend !== undefined ? { agentBackend: body.agentBackend } : {}),
            },
        );
    }

    @Post(":id/cancel")
    @HttpCode(HttpStatus.OK)
    async cancel(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        const job = await this.cancelJob.execute(resolveUserId(user), id, new Date());
        if (job === null) throw new NotFoundException("Job not found");
        return { job };
    }

    @Post(":id/feedback")
    @HttpCode(HttpStatus.OK)
    async feedback(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(feedbackBodySchema)) body: FeedbackBody,
    ) {
        return this.submitFeedback.execute(buildFeedbackInput(resolveUserId(user), id, body));
    }
}

function buildFeedbackInput(
    userId: string,
    jobId: string,
    body: FeedbackBody,
): SubmitJobFeedbackInput {
    const target = body.targetId !== undefined ? { targetId: body.targetId } : {};
    switch (body.kind) {
        case JOB_FEEDBACK_KIND.rating:
            return { userId, jobId, kind: body.kind, ratingValue: body.ratingValue, ...target };
        case JOB_FEEDBACK_KIND.edit:
            return { userId, jobId, kind: body.kind, editedContent: body.editedContent, ...target };
        default:
            return { userId, jobId, kind: body.kind, ...target };
    }
}
