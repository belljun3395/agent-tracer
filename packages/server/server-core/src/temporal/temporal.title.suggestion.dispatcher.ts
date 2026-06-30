import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
    LLM_JOB_QUEUE,
    TITLE_SUGGESTION_JOB,
} from "@monitor/shared/job/llm.job.const.js";
import type { ITitleSuggestionDispatcher } from "@monitor/run-api/task/application/outbound/title.suggestion.dispatcher.port.js";
import type { SuggestTaskTitleUseCaseOut } from "@monitor/run-api/task/application/dto/suggest.task.title.usecase.dto.js";
import { TemporalClientProvider } from "./temporal.client.provider.js";

@Injectable()
export class TemporalTitleSuggestionDispatcher implements ITitleSuggestionDispatcher {
    constructor(private readonly clients: TemporalClientProvider) {}

    // execute는 워크플로 완료까지 기다려 제안 결과를 그대로 돌려준다.
    async dispatch(taskId: string): Promise<SuggestTaskTitleUseCaseOut> {
        const client = await this.clients.get();
        return client.workflow.execute<
            (taskId: string) => Promise<SuggestTaskTitleUseCaseOut>
        >(TITLE_SUGGESTION_JOB, {
            taskQueue: LLM_JOB_QUEUE,
            workflowId: `title-suggestion-${taskId}-${randomUUID()}`,
            args: [taskId],
        });
    }
}
