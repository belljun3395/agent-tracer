import { Context } from "@temporalio/activity";
import { Injectable } from "@nestjs/common";
import { ExecuteChatExecutionUseCase } from "~tracer-api/domain/chat/application/command/execute.chat.execution.usecase.js";
import { FailChatExecutionUseCase } from "~tracer-api/domain/chat/application/command/fail.chat.execution.usecase.js";
import { GetNextChatExecutionUseCase } from "~tracer-api/domain/chat/application/query/get.next.chat.execution.usecase.js";
import type {
    ChatExecutionWorkflowInput,
    FailChatExecutionInput,
} from "~tracer-api/domain/chat/model/chat.workflow.spec.js";

const HEARTBEAT_MS = 10_000;

/** Temporal activity 호출을 chat 실행 유스케이스에 잇고 취소 신호를 모델 호출까지 전파한다. */
@Injectable()
export class ChatExecutionActivity {
    constructor(
        private readonly executeExecution: ExecuteChatExecutionUseCase,
        private readonly failExecution: FailChatExecutionUseCase,
        private readonly getNextExecution: GetNextChatExecutionUseCase,
    ) {}

    executeChatExecution = async (input: ChatExecutionWorkflowInput): Promise<void> => {
        const context = Context.current();
        const heartbeat = setInterval(() => Context.current().heartbeat(), HEARTBEAT_MS);
        try {
            await this.executeExecution.execute(input.executionId, context.cancellationSignal);
        } finally {
            clearInterval(heartbeat);
        }
    };

    failChatExecution = (input: FailChatExecutionInput): Promise<void> =>
        this.failExecution.execute(input.executionId, input.error);

    getNextChatExecution = (threadId: string): Promise<string | null> =>
        this.getNextExecution.execute(threadId);
}
