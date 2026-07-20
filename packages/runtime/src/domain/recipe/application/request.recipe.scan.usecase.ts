import {hasRecipeScanCommand, readRecipeScanIntent} from "~runtime/domain/recipe/model/scan.command.model.js";
import type {RecipeScanJobPort} from "~runtime/domain/recipe/port/recipe.scan.job.port.js";

/** 스캔을 부른 사용자 발화이며 그 이벤트 ID가 멱등키가 된다. */
export interface RecipeScanRequest {
    readonly taskId: string;
    readonly eventId: string;
    readonly prompt: string;
}

/** 사용자가 세션 중 부른 레시피 스캔 잡을 서버 큐에 넣으며, 서버가 잠깐 죽어도 도구 호출이 예외로 튀지 않도록 흡수한다. */
export class RequestRecipeScanUsecase {
    constructor(private readonly jobs: RecipeScanJobPort) {}

    async execute(request: RecipeScanRequest): Promise<boolean> {
        if (request.taskId === "" || request.eventId === "") return false;
        if (!hasRecipeScanCommand(request.prompt)) return false;
        try {
            if (await this.jobs.hasActiveScan(request.taskId)) return false;
            return await this.jobs.enqueue(request.taskId, request.eventId, readRecipeScanIntent(request.prompt));
        } catch {
            return false;
        }
    }
}
