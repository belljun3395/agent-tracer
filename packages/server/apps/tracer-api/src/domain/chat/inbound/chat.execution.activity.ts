import { Context } from "@temporalio/activity";
import { Injectable } from "@nestjs/common";
import { PrepareChatExecutionUseCase } from "~tracer-api/domain/chat/application/command/prepare.chat.execution.usecase.js";
import { GenerateChatExecutionUseCase } from "~tracer-api/domain/chat/application/command/generate.chat.execution.usecase.js";
import { FinalizeChatExecutionUseCase } from "~tracer-api/domain/chat/application/command/finalize.chat.execution.usecase.js";
import { FailChatExecutionUseCase } from "~tracer-api/domain/chat/application/command/fail.chat.execution.usecase.js";
import { GetNextChatExecutionUseCase } from "~tracer-api/domain/chat/application/query/get.next.chat.execution.usecase.js";
import type {
    ChatExecutionWorkflowInput,
    FailChatExecutionInput,
} from "~tracer-api/domain/chat/model/chat.workflow.spec.js";
import type { GeneratedChatExecution, PreparedChatExecution } from "~tracer-api/domain/chat/model/chat.execution.stage.js";

const HEARTBEAT_MS = 10_000;

/** Temporal activity 호출을 chat 실행 유스케이스에 잇고 취소 신호를 모델 호출까지 전파한다. */
@Injectable()
export class ChatExecutionActivity {
    constructor(
        private readonly prepareExecution: PrepareChatExecutionUseCase,
        private readonly generateExecution: GenerateChatExecutionUseCase,
        private readonly finalizeExecution: FinalizeChatExecutionUseCase,
        private readonly failExecution: FailChatExecutionUseCase,
        private readonly getNextExecution: GetNextChatExecutionUseCase,
    ) {}

    prepareChatExecution = (input: ChatExecutionWorkflowInput): Promise<PreparedChatExecution> =>
        this.prepareExecution.execute(input.executionId);

    generateChatExecution = async (prepared: PreparedChatExecution): Promise<GeneratedChatExecution> => {
        const context = Context.current();
        const heartbeat = setInterval(() => Context.current().heartbeat(), HEARTBEAT_MS);
        try {
            return await this.generateExecution.execute(prepared, context.cancellationSignal);
        } finally {
            clearInterval(heartbeat);
        }
    };

    finalizeChatExecution = (generated: GeneratedChatExecution): Promise<void> =>
        this.finalizeExecution.execute(generated);

    failChatExecution = (input: FailChatExecutionInput): Promise<void> =>
        this.failExecution.execute(input.executionId, input.error);

    getNextChatExecution = (threadId: string): Promise<string | null> =>
        this.getNextExecution.execute(threadId);
}
