import { Inject, Injectable } from "@nestjs/common";
import type { AiJobRecordedStep, AiJobStepList } from "@monitor/kernel";
import type { AiJobStepEntity } from "@monitor/tracer-domain";
import { AI_JOB_REPOSITORY, type AiJobRepositoryPort } from "~tracer-api/domain/job/port/ai.job.repository.port.js";
import { AI_JOB_STEP_REPOSITORY, type AiJobStepRepositoryPort } from "~tracer-api/domain/job/port/ai.job.step.repository.port.js";

/** 소유한 잡의 실행 궤적 스텝을 순서대로 조회한다. */
@Injectable()
export class GetJobStepsUseCase {
    constructor(
        @Inject(AI_JOB_REPOSITORY)
        private readonly jobs: AiJobRepositoryPort,
        @Inject(AI_JOB_STEP_REPOSITORY)
        private readonly jobSteps: AiJobStepRepositoryPort,
    ) {}

    async execute(userId: string, jobId: string): Promise<AiJobStepList | null> {
        const job = await this.jobs.findById(jobId);
        if (job === null || !job.isOwnedBy(userId)) return null;
        return (await this.jobSteps.findByJobId(jobId, userId)).map(mapAiJobStep);
    }
}

function mapAiJobStep(step: AiJobStepEntity): AiJobRecordedStep {
    return {
        seq: step.seq,
        attempt: step.attempt,
        role: step.role,
        content: step.content,
        truncated: step.truncated,
        toolCalls: step.toolCalls ?? [],
        ...(step.toolName !== null ? { toolName: step.toolName } : {}),
        ...(step.toolCallId !== null ? { toolCallId: step.toolCallId } : {}),
        ...(step.inputTokens !== null ? { inputTokens: step.inputTokens } : {}),
        ...(step.outputTokens !== null ? { outputTokens: step.outputTokens } : {}),
        ...(step.cacheReadTokens !== null ? { cacheReadTokens: step.cacheReadTokens } : {}),
        ...(step.cacheCreationTokens !== null ? { cacheCreationTokens: step.cacheCreationTokens } : {}),
        ...(step.stopReason !== null ? { stopReason: step.stopReason } : {}),
        ...(step.nodeName !== null ? { nodeName: step.nodeName } : {}),
        ...(step.eventKind !== null ? { eventKind: step.eventKind } : {}),
        ...(step.durationMs !== null ? { durationMs: step.durationMs } : {}),
    };
}
