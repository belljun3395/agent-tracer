import { APP_SETTING_KEYS, JOB_STATUS } from "@monitor/kernel";
import type { IClock } from "@monitor/platform";
import { clampInt } from "~ai-agent-worker/support/clamp.js";
import { normalizeAgentBackend, type AgentBackend } from "~ai-agent-worker/support/llm/agent.backend.js";
import { normalizeOutputLanguage } from "~ai-agent-worker/support/output.language.js";
import { buildCleanupCandidates } from "~ai-agent-worker/domain/cleanup/model/cleanup.candidate.model.js";
import type {
    TaskCleanupInput,
    TaskCleanupPrep,
} from "~ai-agent-worker/domain/cleanup/model/cleanup.job.model.js";
import {
    JobAlreadySettledError,
    JobNotFoundError,
    MissingApiKeyError,
} from "~ai-agent-worker/domain/cleanup/model/cleanup.error.js";
import type { CleanupAgentRegistry } from "~ai-agent-worker/domain/cleanup/port/cleanup.agent.port.js";
import type { CleanupNotificationPort } from "~ai-agent-worker/domain/cleanup/port/cleanup.notification.port.js";
import type { CleanupRepositoryPort } from "~ai-agent-worker/domain/cleanup/port/cleanup.repository.port.js";

const DEFAULT_MAX_SUGGESTIONS = 20;
const MAX_SUGGESTIONS_CAP = 50;

/** 후보를 결정론적으로 계산하고 잡을 실행 상태로 올린 뒤 실행 인자를 확정한다. */
export class PrepareTaskCleanupUsecase {
    constructor(
        private readonly repository: CleanupRepositoryPort,
        private readonly agents: CleanupAgentRegistry,
        private readonly notification: CleanupNotificationPort,
        private readonly clock: IClock,
        private readonly defaultBackend: AgentBackend,
    ) {}

    async execute(input: TaskCleanupInput): Promise<TaskCleanupPrep> {
        const job = await this.repository.findJob(input.jobId);
        if (job === null) throw new JobNotFoundError(input.jobId);

        const agentBackend = normalizeAgentBackend(input.agentBackend, this.defaultBackend);
        const agent = this.agents[agentBackend];

        const now = this.clock.now();
        if (!(await this.repository.startJob(job.id, now))) throw new JobAlreadySettledError(job.id);
        await this.notification.jobUpdated(job.userId, { jobId: job.id, status: JOB_STATUS.running });

        if (agent.requiresLocalApiKey()) {
            const apiKey = await this.repository.readSetting(APP_SETTING_KEYS.anthropicApiKey);
            if (apiKey === null) throw new MissingApiKeyError(APP_SETTING_KEYS.anthropicApiKey);
        }
        const model = await this.repository.readSetting(APP_SETTING_KEYS.anthropicModel);
        const language = normalizeOutputLanguage(
            await this.repository.readSetting(APP_SETTING_KEYS.claudeOutputLanguage),
        );
        const maxSuggestions = await this.resolveMaxSuggestions(input.maxSuggestions);

        const batch = await this.repository.loadScanBatch(job.userId);
        const candidates = buildCleanupCandidates({
            tasks: batch.tasks,
            activeChildParentIds: batch.activeChildParentIds,
            now,
        });

        return {
            jobId: job.id,
            userId: job.userId,
            agentBackend,
            language,
            maxSuggestions,
            candidates,
            truncated: batch.truncated,
            tasksScanned: batch.tasksScanned,
            ...(model !== null ? { model } : {}),
        };
    }

    private async resolveMaxSuggestions(requested: number | undefined): Promise<number> {
        if (requested !== undefined) return clampInt(requested, DEFAULT_MAX_SUGGESTIONS, 1, MAX_SUGGESTIONS_CAP);
        const raw = await this.repository.readSetting(APP_SETTING_KEYS.taskCleanupMaxSuggestions);
        const parsed = raw !== null ? Number.parseInt(raw, 10) : Number.NaN;
        return clampInt(parsed, DEFAULT_MAX_SUGGESTIONS, 1, MAX_SUGGESTIONS_CAP);
    }
}
