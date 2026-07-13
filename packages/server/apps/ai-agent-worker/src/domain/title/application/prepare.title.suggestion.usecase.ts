import { APP_SETTING_KEYS, JOB_STATUS } from "@monitor/kernel";
import type { IClock } from "@monitor/platform";
import { normalizeAgentBackend, type AgentBackend } from "~ai-agent-worker/support/llm/agent.backend.js";
import { normalizeOutputLanguage } from "~ai-agent-worker/support/output.language.js";
import type {
    TitleSuggestionInput,
    TitleSuggestionPrep,
} from "~ai-agent-worker/domain/title/model/title.job.model.js";
import {
    JobAlreadySettledError,
    JobNotFoundError,
    MissingApiKeyError,
    TaskHasNoEventsError,
    TaskNotFoundError,
} from "~ai-agent-worker/domain/title/model/title.error.js";
import type { TitleAgentRegistry } from "~ai-agent-worker/domain/title/port/title.agent.port.js";
import type { TitleNotificationPort } from "~ai-agent-worker/domain/title/port/title.notification.port.js";
import type { TitleRepositoryPort } from "~ai-agent-worker/domain/title/port/title.repository.port.js";

/** 대화 컨텍스트를 모으고 잡을 실행 상태로 올린 뒤 실행 인자를 확정한다. */
export class PrepareTitleSuggestionUsecase {
    constructor(
        private readonly repository: TitleRepositoryPort,
        private readonly agents: TitleAgentRegistry,
        private readonly notification: TitleNotificationPort,
        private readonly clock: IClock,
        private readonly defaultBackend: AgentBackend,
    ) {}

    async execute(input: TitleSuggestionInput): Promise<TitleSuggestionPrep> {
        const job = await this.repository.findJob(input.jobId);
        if (job === null) throw new JobNotFoundError(input.jobId);

        const agentBackend = normalizeAgentBackend(input.agentBackend, this.defaultBackend);
        const agent = this.agents[agentBackend];

        const found = await this.repository.findTaskContext(job.userId, input.taskId);
        if (found === null || !found.ownedByUser || found.context === null) {
            throw new TaskNotFoundError(input.taskId);
        }
        if (found.totalEventCount === 0) throw new TaskHasNoEventsError(input.taskId);

        const now = this.clock.now();
        if (!(await this.repository.startJob(job.id, now))) throw new JobAlreadySettledError(job.id);
        await this.notification.jobUpdated(job.userId, {
            jobId: job.id,
            status: JOB_STATUS.running,
            taskId: input.taskId,
        });

        if (agent.requiresLocalApiKey()) {
            const apiKey = await this.repository.readSetting(APP_SETTING_KEYS.anthropicApiKey);
            if (apiKey === null) throw new MissingApiKeyError(APP_SETTING_KEYS.anthropicApiKey);
        }
        const model = await this.repository.readSetting(APP_SETTING_KEYS.anthropicModel);
        const language = normalizeOutputLanguage(
            await this.repository.readSetting(APP_SETTING_KEYS.claudeOutputLanguage),
        );

        return {
            jobId: job.id,
            userId: job.userId,
            taskId: input.taskId,
            agentBackend,
            language,
            currentTitle: found.context.title,
            context: found.context,
            ...(model !== null ? { model } : {}),
        };
    }
}
