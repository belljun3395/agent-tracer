import {hasRecipeScanCommand, readRecipeScanIntent} from "~runtime/domain/recipe/model/scan.command.model.js";
import type {RecipeScanJobPort} from "~runtime/domain/recipe/port/recipe.scan.job.port.js";

/** 스캔을 부른 사용자 발화이며 그 이벤트 ID가 멱등키가 된다. */
export interface RecipeScanRequest {
    readonly taskId: string;
    readonly eventId: string;
    readonly prompt: string;
}

/** 사용자가 세션 중 부른 레시피 스캔 잡을 서버 큐에 넣는다. */
export class RequestRecipeScanUsecase {
    constructor(private readonly jobs: RecipeScanJobPort) {}

    async execute(request: RecipeScanRequest): Promise<boolean> {
        if (request.taskId === "" || request.eventId === "") return false;
        if (!hasRecipeScanCommand(request.prompt)) return false;
        if (await this.jobs.hasActiveScan(request.taskId)) return false;
        return this.jobs.enqueue(request.taskId, request.eventId, readRecipeScanIntent(request.prompt));
    }
}
