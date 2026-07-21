import { AI_AGENT_BACKEND } from "@monitor/kernel";
import { loadApplicationConfig, SystemClock } from "@monitor/platform";
import { ClaudeQueryRunner } from "@monitor/llm-runtime";
import {
    AiJobRepository,
    AppSettingRepository,
    ChatMessageRepository,
    ChatPendingToolRepository,
    ChatThreadRepository,
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
} from "@monitor/tracer-domain";
import { CreateThreadUseCase } from "~tracer-api/domain/chat/application/command/create.thread.usecase.js";
import { AppendUserMessageUseCase } from "~tracer-api/domain/chat/application/command/append.user.message.usecase.js";
import { RunChatTurnUseCase } from "~tracer-api/domain/chat/application/command/run.chat.turn.usecase.js";
import { ConfirmToolUseCase } from "~tracer-api/domain/chat/application/command/confirm.tool.usecase.js";
import { ListThreadsUseCase } from "~tracer-api/domain/chat/application/query/list.threads.usecase.js";
import { GetThreadUseCase } from "~tracer-api/domain/chat/application/query/get.thread.usecase.js";
import { GetMessagesUseCase } from "~tracer-api/domain/chat/application/query/get.messages.usecase.js";
import { ChatController } from "~tracer-api/domain/chat/inbound/chat.controller.js";
import { ChatSdkAgentAdapter } from "~tracer-api/domain/chat/adapter/chat.sdk.agent.adapter.js";
import { ChatPythonAgentPlaceholder } from "~tracer-api/domain/chat/adapter/chat.python.agent.placeholder.js";
import { ChatOpenSearchAdapter } from "~tracer-api/domain/chat/adapter/chat.search.adapter.js";
import type { ChatToolDeps } from "~tracer-api/domain/chat/adapter/chat.tools.js";
import { CHAT_CLOCK, type ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import {
    CHAT_MESSAGE_REPOSITORY,
    CHAT_PENDING_TOOL_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    type ChatPendingToolRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { CHAT_AGENT_REGISTRY, type ChatAgentRegistry } from "~tracer-api/domain/chat/port/chat.agent.port.js";
import { CHAT_EVENT_SEARCH, type ChatEventSearchPort } from "~tracer-api/domain/chat/port/chat.search.port.js";

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
    CHAT_CLOCK,
];

function buildRegistry(...args: unknown[]): ChatAgentRegistry {
    const [
        tasks, taskUserStates, sessions, events, memos, rules, verdicts, tags, taskTags,
        recipes, recipeApplications, cleanupSuggestions, jobs, settings, search, pendingTools, clock,
    ] = args as [
        TaskRepository, TaskUserStateRepository, SessionRepository, EventRepository, MemoRepository,
        RuleRepository, VerdictRepository, TagRepository, TaskTagRepository, RecipeRepository,
        RecipeApplicationRepository, TaskCleanupSuggestionRepository, AiJobRepository, AppSettingRepository,
        ChatEventSearchPort, ChatPendingToolRepositoryPort, ClockPort,
    ];
    const deps: ChatToolDeps = {
        tasks, taskUserStates, sessions, events, memos, rules, verdicts, tags, taskTags,
        recipes, recipeApplications, cleanupSuggestions, jobs, settings, search,
    };
    // local 프로파일은 API 키 없이 로그인된 claude CLI(구독) 자격증명으로 SDK를 실행한다.
    const runner = new ClaudeQueryRunner(loadApplicationConfig().profile === "local");
    return {
        [AI_AGENT_BACKEND.claudeSdk]: new ChatSdkAgentAdapter(runner, deps, { pendingTools, clock }),
        [AI_AGENT_BACKEND.python]: new ChatPythonAgentPlaceholder(),
    };
}

/** chat 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const chatFeature = {
    controllers: [ChatController],
    providers: [
        ListThreadsUseCase,
        GetThreadUseCase,
        GetMessagesUseCase,
        CreateThreadUseCase,
        AppendUserMessageUseCase,
        RunChatTurnUseCase,
        ConfirmToolUseCase,
        { provide: CHAT_CLOCK, useClass: SystemClock },
        { provide: CHAT_EVENT_SEARCH, useClass: ChatOpenSearchAdapter },
        { provide: CHAT_THREAD_REPOSITORY, useExisting: ChatThreadRepository },
        { provide: CHAT_MESSAGE_REPOSITORY, useExisting: ChatMessageRepository },
        { provide: CHAT_PENDING_TOOL_REPOSITORY, useExisting: ChatPendingToolRepository },
        { provide: CHAT_AGENT_REGISTRY, inject: REGISTRY_DEPS, useFactory: buildRegistry },
    ],
};
