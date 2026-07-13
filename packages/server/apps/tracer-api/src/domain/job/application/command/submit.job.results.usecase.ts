import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { JOB_KIND, JOB_STATUS } from "@monitor/kernel";
import {
    JobTransitionLostError,
    isJobTransitionLost,
    type AiJobEntity,
} from "@monitor/tracer-domain";
import { AI_JOB_REPOSITORY, type AiJobRepositoryPort } from "~tracer-api/domain/job/port/ai.job.repository.port.js";
import { mapJob, type JobDto } from "~tracer-api/domain/job/model/job.model.js";
import { JOB_TRANSACTION, type JobTransactionPort } from "~tracer-api/domain/job/port/transaction.port.js";
import { RuleGenerationResultService } from "~tracer-api/domain/job/application/rule.generation.result.service.js";

const NON_TERMINAL = [JOB_STATUS.pending, JOB_STATUS.running] as const;

export interface SubmitJobResultsInput {
    readonly userId: string;
    readonly id: string;
    readonly proposals?: readonly unknown[];
    readonly result?: Record<string, unknown>;
    readonly usage?: Record<string, unknown>;
}

/** AI 잡 결과를 수락해 산출물을 저장하고 잡을 종결한다. */
@Injectable()
export class SubmitJobResultsUseCase {
    constructor(
        @Inject(AI_JOB_REPOSITORY)
        private readonly jobs: AiJobRepositoryPort,
        @Inject(JOB_TRANSACTION)
        private readonly tx: JobTransactionPort,
        private readonly generatedRules: RuleGenerationResultService,
    ) {}

    async execute(input: SubmitJobResultsInput): Promise<{ readonly job: JobDto }> {
        const owned = await this.jobs.findById(input.id);
        if (owned === null || !owned.isOwnedBy(input.userId)) throw new NotFoundException("Job not found");
        const now = new Date();

        const settled = await this.runSubmitTransaction(input, now);
        if (settled === null) {
            const current = await this.jobs.findById(input.id);
            return { job: mapJob(current ?? owned) };
        }

        if (settled.afterCommit !== null) await settled.afterCommit();
        return { job: mapJob(settled.job) };
    }

    private async runSubmitTransaction(
        input: SubmitJobResultsInput,
        now: Date,
    ): Promise<{ readonly job: AiJobEntity; readonly afterCommit: (() => Promise<void>) | null } | null> {
        try {
            return await this.tx.run(async (tx) => {
                const job = await tx.jobs.findById(input.id);
                if (job === null) throw new JobTransitionLostError(input.id);
                const usage = input.usage ?? {};

                let afterCommit: (() => Promise<void>) | null = null;
                if (job.kind === JOB_KIND.ruleGeneration) {
                    const prepared = await this.generatedRules.prepare({
                        rules: tx.rules,
                        userId: job.userId,
                        sourceJobId: job.id,
                        taskId: job.taskId,
                        jobInput: job.input,
                        proposals: input.proposals ?? [],
                        now,
                    });
                    afterCommit = prepared.afterCommit;
                    job.complete(prepared.jobResult, usage, now);
                } else {
                    job.complete(input.result ?? {}, usage, now);
                }
                if (!(await tx.jobs.commitTransition(job, NON_TERMINAL))) {
                    throw new JobTransitionLostError(job.id);
                }
                return { job, afterCommit };
            });
        } catch (error) {
            if (isJobTransitionLost(error)) return null;
            throw error;
        }
    }
}
