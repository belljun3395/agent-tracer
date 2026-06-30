import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
    LLM_JOB_QUEUE,
    TITLE_SUGGESTION_JOB,
} from "@monitor/shared/job/llm.job.const.js";
import { TemporalClientProvider } from "@monitor/shared/job/temporal.client.provider.js";
import type { ITitleSuggestionDispatcher } from "../../application/task/outbound/title.suggestion.dispatcher.port.js";

type TitleSuggestionResult = Awaited<
    ReturnType<ITitleSuggestionDispatcher["dispatch"]>
>;

// 제목 제안 실행을 Temporal 워크플로로 넘기고 결과를 동기로 돌려받는다.
@Injectable()
export class TemporalTitleSuggestionDispatcher implements ITitleSuggestionDispatcher {
    constructor(private readonly clients: TemporalClientProvider) {}

    async dispatch(taskId: string): Promise<TitleSuggestionResult> {
        const client = await this.clients.get();
        return client.workflow.execute<
            (taskId: string) => Promise<TitleSuggestionResult>
        >(TITLE_SUGGESTION_JOB, {
            taskQueue: LLM_JOB_QUEUE,
            workflowId: `title-suggestion-${taskId}-${randomUUID()}`,
            args: [taskId],
        });
    }
}
