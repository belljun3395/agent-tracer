import { APP_SETTING_KEYS, DEFAULT_USER_ID, JOB_STATUS, RECIPE_SCAN_TRIGGER } from "@monitor/kernel";
import type { IClock } from "@monitor/platform";
import { normalizeAgentBackend, type AgentBackend } from "~ai-agent-worker/support/llm/agent.backend.js";
import { normalizeOutputLanguage } from "~ai-agent-worker/support/output.language.js";
import type {
    RecipeScanInput,
    RecipeScanPrep,
} from "~ai-agent-worker/domain/recipe/model/recipe.job.model.js";
import {
    JobAlreadySettledError,
    JobNotFoundError,
    MissingApiKeyError,
    TaskNotFoundError,
    TaskNotScannableError,
} from "~ai-agent-worker/domain/recipe/model/recipe.error.js";
import type { RecipeAgentRegistry } from "~ai-agent-worker/domain/recipe/port/recipe.agent.port.js";
import type { RecipeNotificationPort } from "~ai-agent-worker/domain/recipe/port/recipe.notification.port.js";
import type { RecipeRepositoryPort } from "~ai-agent-worker/domain/recipe/port/recipe.repository.port.js";

/** 앵커 자격을 확인하고 잡을 실행 상태로 올린 뒤 실행 인자를 확정한다. */
export class PrepareRecipeScanUsecase {
    constructor(
        private readonly repository: RecipeRepositoryPort,
        private readonly agents: RecipeAgentRegistry,
        private readonly notification: RecipeNotificationPort,
        private readonly clock: IClock,
        private readonly defaultBackend: AgentBackend,
    ) {}

    async execute(input: RecipeScanInput): Promise<RecipeScanPrep> {
        const job = await this.repository.findJob(input.jobId);
        if (job === null) throw new JobNotFoundError(input.jobId);

        const agentBackend = normalizeAgentBackend(input.agentBackend, this.defaultBackend);
        const agent = this.agents[agentBackend];

        const anchor = await this.repository.findAnchor(job.userId, input.taskId);
        if (anchor === null || !anchor.ownedByUser) throw new TaskNotFoundError(input.taskId);
        const eligible = input.trigger === RECIPE_SCAN_TRIGGER.session
            ? anchor.sessionScanEligible
            : anchor.scanEligible;
        if (!eligible) throw new TaskNotScannableError(input.taskId);

        const now = this.clock.now();
        if (!(await this.repository.startJob(job.id, now))) throw new JobAlreadySettledError(job.id);
        await this.notification.jobUpdated(job.userId, {
            jobId: job.id,
            status: JOB_STATUS.running,
            taskId: input.taskId,
        });

        if (agent.requiresLocalApiKey()) {
            const apiKey = await this.repository.readSetting(DEFAULT_USER_ID, APP_SETTING_KEYS.anthropicApiKey);
            if (apiKey === null) throw new MissingApiKeyError(APP_SETTING_KEYS.anthropicApiKey);
        }
        const model = await this.repository.readSetting(DEFAULT_USER_ID, APP_SETTING_KEYS.anthropicModel);

        return {
            jobId: job.id,
            userId: job.userId,
            taskId: input.taskId,
            agentBackend,
            language: normalizeOutputLanguage(input.language),
            ...(input.userPrompt !== undefined ? { userPrompt: input.userPrompt } : {}),
            ...(model !== null ? { model } : {}),
        };
    }
}
