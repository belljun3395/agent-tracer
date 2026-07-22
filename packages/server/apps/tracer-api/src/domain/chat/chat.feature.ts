import { AI_AGENT_BACKEND, normalizeAiAgentBackend, type AiAgentBackend } from "@monitor/kernel";
import { loadApplicationConfig, SystemClock } from "@monitor/platform";
import { ClaudeQueryRunner } from "@monitor/llm-runtime";
import {
    AiJobRepository,
    AppSettingRepository,
    ChatMessageRepository,
    ChatExecutionRepository,
    ChatPendingToolRepository,
    ChatThreadRepository,
    ChatUserMemoryRepository,
    EventRepository,
    MemoRepository,
    RecipeApplicationRepository,
    RecipeRepository,
    RuleRepository,
    SessionRepository,
    TagRepository,
    TaskCleanupSuggestionRepository,
    TaskRepository,
    TaskTagRepository,
    TaskUserStateRepository,
    VerdictRepository,
    TransactionRunner,
} from "@monitor/tracer-domain";
import { CreateThreadUseCase } from "~tracer-api/domain/chat/application/command/create.thread.usecase.js";
import { AppendUserMessageUseCase } from "~tracer-api/domain/chat/application/command/append.user.message.usecase.js";
import { EnqueueChatTurnUseCase } from "~tracer-api/domain/chat/application/command/enqueue.chat.turn.usecase.js";
import { CancelChatExecutionUseCase } from "~tracer-api/domain/chat/application/command/cancel.chat.execution.usecase.js";
import { PrepareChatExecutionUseCase } from "~tracer-api/domain/chat/application/command/prepare.chat.execution.usecase.js";
import { GenerateChatExecutionUseCase } from "~tracer-api/domain/chat/application/command/generate.chat.execution.usecase.js";
import { FinalizeChatExecutionUseCase } from "~tracer-api/domain/chat/application/command/finalize.chat.execution.usecase.js";
import { FailChatExecutionUseCase } from "~tracer-api/domain/chat/application/command/fail.chat.execution.usecase.js";
import { SummarizeThreadProjection } from "~tracer-api/domain/chat/application/command/summarize.thread.projection.js";
import { GenerateThreadTitleProjection } from "~tracer-api/domain/chat/application/command/generate.thread.title.projection.js";
import { ConfirmToolUseCase } from "~tracer-api/domain/chat/application/command/confirm.tool.usecase.js";
import { DeleteThreadUseCase } from "~tracer-api/domain/chat/application/command/delete.thread.usecase.js";
import { RenameThreadUseCase } from "~tracer-api/domain/chat/application/command/rename.thread.usecase.js";
import { ListThreadsUseCase } from "~tracer-api/domain/chat/application/query/list.threads.usecase.js";
import { GetThreadUseCase } from "~tracer-api/domain/chat/application/query/get.thread.usecase.js";
import { GetMessagesUseCase } from "~tracer-api/domain/chat/application/query/get.messages.usecase.js";
import { ListChatExecutionsUseCase } from "~tracer-api/domain/chat/application/query/list.chat.executions.usecase.js";
import { WatchChatExecutionUseCase } from "~tracer-api/domain/chat/application/query/watch.chat.execution.usecase.js";
import { GetNextChatExecutionUseCase } from "~tracer-api/domain/chat/application/query/get.next.chat.execution.usecase.js";
import { ChatController } from "~tracer-api/domain/chat/inbound/chat.controller.js";
import { ChatExecutionActivity } from "~tracer-api/domain/chat/inbound/chat.execution.activity.js";
import { ChatSdkAgentAdapter } from "~tracer-api/domain/chat/adapter/chat.sdk.agent.adapter.js";
import { ChatGraphAgentAdapter } from "~tracer-api/domain/chat/adapter/chat.graph.agent.adapter.js";
import { buildChatGraphStreamClient } from "~tracer-api/domain/chat/adapter/chat.graph.client.factory.js";
import { ChatOpenSearchAdapter } from "~tracer-api/domain/chat/adapter/chat.search.adapter.js";
import { ChatSummarizerAdapter } from "~tracer-api/domain/chat/adapter/chat.summarizer.adapter.js";
import { ChatWorkflowDispatcher } from "~tracer-api/domain/chat/adapter/chat.workflow.dispatcher.js";
import { ChatScheduler } from "~tracer-api/domain/chat/adapter/chat.scheduler.js";
import { ChatExecutionEvents } from "~tracer-api/domain/chat/adapter/chat.execution.events.js";
import { ChatExecutionSinkFactory } from "~tracer-api/domain/chat/adapter/chat.execution.sink.js";
import type { ChatToolDeps } from "~tracer-api/domain/chat/adapter/chat.tools.js";
import { CHAT_CLOCK, type ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import {
    CHAT_MESSAGE_REPOSITORY,
    CHAT_EXECUTION_REPOSITORY,
    CHAT_PENDING_TOOL_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    CHAT_USER_MEMORY_REPOSITORY,
    type ChatPendingToolRepositoryPort,
    type ChatUserMemoryRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { CHAT_TRANSACTION } from "~tracer-api/domain/chat/port/chat.transaction.port.js";
import { CHAT_EXECUTION_DISPATCHER } from "~tracer-api/domain/chat/port/chat.execution.dispatcher.port.js";
import { CHAT_AGENT_REGISTRY, type ChatAgentRegistry } from "~tracer-api/domain/chat/port/chat.agent.port.js";
import { CHAT_DEFAULT_AGENT_BACKEND } from "~tracer-api/domain/chat/port/agent.backend.port.js";
import { CHAT_SETTING_READER } from "~tracer-api/domain/chat/port/setting.reader.port.js";
import { CHAT_EVENT_SEARCH, type ChatEventSearchPort } from "~tracer-api/domain/chat/port/chat.search.port.js";
import { CHAT_SUMMARIZER } from "~tracer-api/domain/chat/port/chat.summarizer.port.js";
import { CHAT_SCHEDULER } from "~tracer-api/domain/chat/port/scheduler.port.js";
import { CHAT_EXECUTION_EVENTS } from "~tracer-api/domain/chat/port/chat.execution.events.port.js";
import { CHAT_EXECUTION_SINK_FACTORY } from "~tracer-api/domain/chat/port/chat.execution.sink.port.js";

const REGISTRY_DEPS = [
    TaskRepository,
    TaskUserStateRepository,
    SessionRepository,
    EventRepository,
    MemoRepository,
    RuleRepository,
    VerdictRepository,
    TagRepository,
    TaskTagRepository,
    RecipeRepository,
    RecipeApplicationRepository,
    TaskCleanupSuggestionRepository,
    AiJobRepository,
    AppSettingRepository,
    CHAT_EVENT_SEARCH,
    CHAT_PENDING_TOOL_REPOSITORY,
    ChatUserMemoryRepository,
    CHAT_CLOCK,
];

function buildRegistry(...args: unknown[]): ChatAgentRegistry {
    const [
        tasks, taskUserStates, sessions, events, memos, rules, verdicts, tags, taskTags,
        recipes, recipeApplications, cleanupSuggestions, jobs, settings, search, pendingTools, userMemories, clock,
    ] = args as [
        TaskRepository, TaskUserStateRepository, SessionRepository, EventRepository, MemoRepository,
        RuleRepository, VerdictRepository, TagRepository, TaskTagRepository, RecipeRepository,
        RecipeApplicationRepository, TaskCleanupSuggestionRepository, AiJobRepository, AppSettingRepository,
        ChatEventSearchPort, ChatPendingToolRepositoryPort, ChatUserMemoryRepositoryPort, ClockPort,
    ];
    const deps: ChatToolDeps = {
        tasks, taskUserStates, sessions, events, memos, rules, verdicts, tags, taskTags,
        recipes, recipeApplications, cleanupSuggestions, jobs, settings, search,
    };
    return {
        [AI_AGENT_BACKEND.claudeSdk]: new ChatSdkAgentAdapter(buildRunner(), deps, { pendingTools, clock }, { memories: userMemories, clock }),
        [AI_AGENT_BACKEND.python]: new ChatGraphAgentAdapter(
            buildChatGraphStreamClient(),
            { pendingTools, clock },
            resolveReadApiBaseUrl(),
        ),
    };
}

// Python 에이전트가 읽기 도구로 되읽을 tracer-api 읽기 API의 기점이며, 없으면 자기 루프백을 쓴다.
function resolveReadApiBaseUrl(): string {
    return process.env["AGENT_READ_API_URL"] ?? `http://127.0.0.1:${loadApplicationConfig().tracerApi.port}`;
}

// local 프로파일은 API 키 없이 로그인된 claude CLI(구독) 자격증명으로 SDK를 실행한다.
function buildRunner(): ClaudeQueryRunner {
    return new ClaudeQueryRunner(loadApplicationConfig().profile === "local");
}

// 대화 턴이 백엔드를 지정하지 않았을 때의 기본값이며, local 프로파일은 키 없이 도는 claude-sdk로 향한다.
function resolveDefaultAgentBackend(): AiAgentBackend {
    return normalizeAiAgentBackend(
        process.env["AGENT_BACKEND"],
        loadApplicationConfig().profile === "local" ? AI_AGENT_BACKEND.claudeSdk : AI_AGENT_BACKEND.python,
    );
}

function buildSummarizer(): ChatSummarizerAdapter {
    return new ChatSummarizerAdapter(buildRunner());
}

/** chat 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const chatFeature = {
    controllers: [ChatController],
    providers: [
        ListThreadsUseCase,
        GetThreadUseCase,
        GetMessagesUseCase,
        ListChatExecutionsUseCase,
        WatchChatExecutionUseCase,
        GetNextChatExecutionUseCase,
        ChatScheduler,
        { provide: CHAT_SCHEDULER, useExisting: ChatScheduler },
        ChatExecutionEvents,
        { provide: CHAT_EXECUTION_EVENTS, useExisting: ChatExecutionEvents },
        ChatExecutionSinkFactory,
        { provide: CHAT_EXECUTION_SINK_FACTORY, useExisting: ChatExecutionSinkFactory },
        CreateThreadUseCase,
        AppendUserMessageUseCase,
        EnqueueChatTurnUseCase,
        CancelChatExecutionUseCase,
        PrepareChatExecutionUseCase,
        GenerateChatExecutionUseCase,
        FinalizeChatExecutionUseCase,
        FailChatExecutionUseCase,
        ChatExecutionActivity,
        SummarizeThreadProjection,
        GenerateThreadTitleProjection,
        ConfirmToolUseCase,
        DeleteThreadUseCase,
        RenameThreadUseCase,
        { provide: CHAT_CLOCK, useClass: SystemClock },
        { provide: CHAT_EVENT_SEARCH, useClass: ChatOpenSearchAdapter },
        { provide: CHAT_THREAD_REPOSITORY, useExisting: ChatThreadRepository },
        { provide: CHAT_MESSAGE_REPOSITORY, useExisting: ChatMessageRepository },
        { provide: CHAT_EXECUTION_REPOSITORY, useExisting: ChatExecutionRepository },
        { provide: CHAT_TRANSACTION, useExisting: TransactionRunner },
        ChatWorkflowDispatcher,
        { provide: CHAT_EXECUTION_DISPATCHER, useExisting: ChatWorkflowDispatcher },
        { provide: CHAT_PENDING_TOOL_REPOSITORY, useExisting: ChatPendingToolRepository },
        { provide: CHAT_USER_MEMORY_REPOSITORY, useExisting: ChatUserMemoryRepository },
        { provide: CHAT_AGENT_REGISTRY, inject: REGISTRY_DEPS, useFactory: buildRegistry },
        { provide: CHAT_DEFAULT_AGENT_BACKEND, useFactory: resolveDefaultAgentBackend },
        { provide: CHAT_SETTING_READER, useExisting: AppSettingRepository },
        { provide: CHAT_SUMMARIZER, useFactory: buildSummarizer },
    ],
};
