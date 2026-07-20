import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import {
    DEFAULT_USER_ID,
    JOB_KIND,
    JOB_STATUS,
    type AiAgentBackend,
    type JobKind,
} from "@monitor/kernel";
import { AiJobEntity, LLM_KEY_SETTING, SettingsCatalog } from "@monitor/tracer-domain";
import {
    DEFAULT_AGENT_BACKEND,
    type DefaultAgentBackendPort,
} from "~tracer-api/domain/job/port/agent.backend.port.js";
import { AI_JOB_REPOSITORY, type AiJobRepositoryPort } from "~tracer-api/domain/job/port/ai.job.repository.port.js";
import { CLOCK, type ClockPort } from "~tracer-api/domain/job/port/clock.port.js";
import { JobIdempotencyConflictError, LlmKeyMissingError } from "~tracer-api/domain/job/model/job.errors.js";
import { mapJob, type JobDto } from "~tracer-api/domain/job/model/job.model.js";
import { SETTING_READER, type SettingReaderPort } from "~tracer-api/domain/job/port/setting.reader.port.js";
import { WORKFLOW_DISPATCHER, type WorkflowDispatcherPort } from "~tracer-api/domain/job/port/workflow.dispatcher.port.js";
import { JOB_EVENT_LOG, type JobEventLog } from "~tracer-api/domain/job/port/job.event.log.port.js";

export interface EnqueueJobOptions {
    readonly idempotencyKey?: string;
    readonly agentBackend?: AiAgentBackend;
}

@Injectable()
export class EnqueueJobUseCase {
    constructor(
        @Inject(AI_JOB_REPOSITORY) private readonly jobs: AiJobRepositoryPort,
        @Inject(SETTING_READER) private readonly settings: SettingReaderPort,
        @Inject(WORKFLOW_DISPATCHER) private readonly dispatcher: WorkflowDispatcherPort,
        @Inject(CLOCK) private readonly clock: ClockPort,
        @Inject(DEFAULT_AGENT_BACKEND) private readonly defaultBackend: DefaultAgentBackendPort,
        @Inject(JOB_EVENT_LOG) private readonly jobLog: JobEventLog,
    ) {}

    async execute(
        userId: string,
        kind: JobKind,
        input: Record<string, unknown>,
        options: EnqueueJobOptions = {},
    ): Promise<{ readonly job: JobDto }> {
        const agentBackend = kind === JOB_KIND.ruleGeneration
            ? options.agentBackend
            : options.agentBackend ?? this.defaultBackend;
        const jobInput = withAgentBackend(input, agentBackend);
        if (kind !== JOB_KIND.ruleGeneration) {
            const catalog = new SettingsCatalog(await this.settings.findAllByScope(DEFAULT_USER_ID));
            if (!catalog.llmKeyPresent(LLM_KEY_SETTING)) {
                this.jobLog.llmKeyMissing({ userId, kind });
                throw new LlmKeyMissingError();
            }
        }

        const idempotencyKey = normalizeIdempotencyKey(options.idempotencyKey);
        const inputHash = idempotencyKey !== undefined ? hashJobInput(jobInput) : undefined;
        const job = AiJobEntity.create(
            userId,
            kind,
            jobInput,
            this.clock.now(),
            idempotencyKey !== undefined && inputHash !== undefined
                ? { key: idempotencyKey, inputHash }
                : undefined,
        );
        const saved = await this.saveJob(job, idempotencyKey, inputHash);
        if (saved.created) this.jobLog.enqueued({ userId, jobId: saved.job.id, kind });
        if (!saved.job.runsLocally() && (saved.created || saved.job.status === JOB_STATUS.pending)) {
            await this.dispatcher.start(kind, saved.job.id, userId, saved.job.input);
        }
        return { job: mapJob(saved.job) };
    }

    private async saveJob(
        job: AiJobEntity,
        idempotencyKey: string | undefined,
        inputHash: string | undefined,
    ): Promise<{ readonly job: AiJobEntity; readonly created: boolean }> {
        if (idempotencyKey === undefined || inputHash === undefined) {
            await this.jobs.upsert(job);
            return { job, created: true };
        }
        try {
            await this.jobs.insert(job);
            return { job, created: true };
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
        }
        const existing = await this.jobs.findByIdempotency(job.userId, job.kind, idempotencyKey);
        if (existing === null) {
            this.jobLog.idempotencyConflict({ userId: job.userId, kind: job.kind });
            throw new JobIdempotencyConflictError();
        }
        if (existing.idempotencyInputHash !== inputHash) {
            this.jobLog.idempotencyConflict({ userId: job.userId, kind: job.kind });
            throw new JobIdempotencyConflictError();
        }
        return { job: existing, created: false };
    }
}

function withAgentBackend(
    input: Record<string, unknown>,
    agentBackend: AiAgentBackend | undefined,
): Record<string, unknown> {
    return agentBackend !== undefined ? { ...input, agentBackend } : input;
}

function normalizeIdempotencyKey(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
}

function hashJobInput(input: Record<string, unknown>): string {
    return createHash("sha256")
        .update(JSON.stringify(toCanonicalJsonValue(input)), "utf8")
        .digest("hex");
}

function toCanonicalJsonValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(toCanonicalJsonValue);
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, child]) => [key, toCanonicalJsonValue(child)]),
        );
    }
    return value;
}

function isUniqueViolation(error: unknown): boolean {
    const code = getErrorCode(error);
    if (code === "23505") return true;
    const driverCode = getErrorCode((error as { readonly driverError?: unknown } | null)?.driverError);
    return driverCode === "23505";
}

function getErrorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) return undefined;
    const code = (error as { readonly code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
}
