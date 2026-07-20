import {JOB_KIND, JOB_STATUS, RECIPE_SCAN_TRIGGER} from "@monitor/kernel/job/job.const.js";
import {getJson, postJson} from "~runtime/config/http.js";
import type {RecipeScanJobPort} from "~runtime/domain/recipe/port/recipe.scan.job.port.js";

const ACTIVE_STATUSES: ReadonlySet<string> = new Set([JOB_STATUS.pending, JOB_STATUS.running]);

interface LatestJobEnvelope {
    readonly data?: {readonly job: {readonly status: string} | null};
}

/** 레시피 스캔 잡을 서버 잡 API로 넣는다. */
export class HttpRecipeScanJobAdapter implements RecipeScanJobPort {
    constructor(
        private readonly baseUrl: string,
        private readonly headers: Record<string, string>,
    ) {}

    async hasActiveScan(taskId: string): Promise<boolean> {
        const url = `${this.baseUrl}/api/v1/jobs/latest?kind=${encodeURIComponent(JOB_KIND.recipeScan)}&taskId=${encodeURIComponent(taskId)}`;
        const fetched = await getJson<LatestJobEnvelope>(url, this.headers);
        const status = fetched.kind === "found" ? fetched.value.data?.job?.status : undefined;
        return status !== undefined && ACTIVE_STATUSES.has(status);
    }

    async enqueue(taskId: string, idempotencyKey: string, userPrompt?: string): Promise<boolean> {
        const response = await postJson(`${this.baseUrl}/api/v1/jobs`, this.headers, {
            kind: JOB_KIND.recipeScan,
            input: {
                taskId,
                trigger: RECIPE_SCAN_TRIGGER.session,
                ...(userPrompt !== undefined ? {userPrompt} : {}),
            },
            idempotencyKey,
        });
        return response.ok;
    }
}
