import type {RecipeScanJobPort} from "~runtime/domain/recipe/port/recipe.scan.job.port.js";

export interface RecordedScanEnqueue {
    readonly taskId: string;
    readonly idempotencyKey: string;
    readonly userPrompt?: string;
}

export class InMemoryRecipeScanJob implements RecipeScanJobPort {
    readonly enqueued: RecordedScanEnqueue[] = [];
    private active = false;

    /** 태스크에 이미 진행 중인 스캔이 있는 상황을 재현한다. */
    markActive(): void {
        this.active = true;
    }

    async hasActiveScan(): Promise<boolean> {
        return this.active;
    }

    async enqueue(taskId: string, idempotencyKey: string, userPrompt?: string): Promise<boolean> {
        this.enqueued.push({taskId, idempotencyKey, ...(userPrompt !== undefined ? {userPrompt} : {})});
        return true;
    }
}
