import {
    AGENT,
    CHAT_TOOL,
    CLEANUP_SUGGESTION_STATUSES,
    type RecipeStatus,
    type TaskCleanupSuggestionStatus,
    type TaskOrigin,
    type TaskStatus,
} from "@monitor/kernel";
import { type ToolHandlers, withToolTelemetry } from "@monitor/llm-runtime";
import {
    decodeTaskPageCursor,
    encodeTaskPageCursor,
    type AiJobRepository,
    type AppSettingRepository,
    type EventRepository,
    type MemoRepository,
    type RecipeApplicationRepository,
    type RecipeRepository,
    type RuleRepository,
    type SessionEntity,
    type SessionRepository,
    type TagRepository,
    type TaskCleanupSuggestionRepository,
    type TaskEntity,
    type TaskPageFilter,
    type TaskRepository,
    type TaskTagRepository,
    type TaskUserStateRepository,
    type VerdictRepository,
} from "@monitor/tracer-domain";
import {
    chatLimit,
    numArg as num,
    parseChatToolArgs,
    strArg as str,
} from "~tracer-api/domain/chat/model/chat.tool.schema.js";
import type { ChatEventSearchPort } from "~tracer-api/domain/chat/port/chat.search.port.js";
import {
    mapCleanup,
    mapEvent,
    mapJob,
    mapMemo,
    mapRecipe,
    mapRule,
    mapSession,
    mapSetting,
    mapTag,
} from "./chat.tool.mappers.js";

const AGENT_NAME = AGENT.chat.id;

/** chat 도구가 읽는 저장소와 검색 포트를 묶는다. */
export interface ChatToolDeps {
    readonly tasks: TaskRepository;
    readonly taskUserStates: TaskUserStateRepository;
    readonly sessions: SessionRepository;
    readonly events: EventRepository;
    readonly memos: MemoRepository;
    readonly rules: RuleRepository;
    readonly verdicts: VerdictRepository;
    readonly tags: TagRepository;
    readonly taskTags: TaskTagRepository;
    readonly recipes: RecipeRepository;
    readonly recipeApplications: RecipeApplicationRepository;
    readonly cleanupSuggestions: TaskCleanupSuggestionRepository;
    readonly jobs: AiJobRepository;
    readonly settings: AppSettingRepository;
    readonly search: ChatEventSearchPort;
}

function telemetered<T>(toolName: string, parameters: unknown, run: () => Promise<T>): Promise<T> {
    return withToolTelemetry({ toolName, agentName: AGENT_NAME, parameters }, run);
}

function resumeTarget(task: TaskEntity, sessions: readonly SessionEntity[]): Record<string, unknown> | null {
    // findByTask는 시작 시각 내림차순이라 첫 세션이 가장 최근의 재개 대상이다.
    const session = sessions[0];
    if (session === undefined) return null;
    return {
        taskId: task.id,
        runtimeSource: session.runtimeSource,
        runtimeSessionId: session.runtimeSessionId,
        workspacePath: task.workspacePath,
    };
}

/** 사용자 범위를 고정한 chat 슬라이스 소유의 읽기 도구 핸들러 12개를 만든다. */
export function buildChatToolHandlers(userId: string, deps: ChatToolDeps): ToolHandlers {
    return {
        [CHAT_TOOL.searchTasks]: async (raw) => {
            const a = parseChatToolArgs(CHAT_TOOL.searchTasks, raw);
            const limit = chatLimit(CHAT_TOOL.searchTasks, num(a["limit"]));
            const status = str(a["status"]);
            const origin = str(a["origin"]);
            const parentTaskId = str(a["parentTaskId"]);
            const cursor = str(a["cursor"]);
            const filter: TaskPageFilter = {
                limit,
                ...(status !== undefined ? { status: status as TaskStatus } : {}),
                ...(origin !== undefined ? { origin: origin as TaskOrigin } : {}),
                ...(a["archived"] !== undefined ? { archived: a["archived"] === "true" } : {}),
                ...(a["root"] !== undefined ? { rootOnly: a["root"] === "true" } : {}),
                ...(parentTaskId !== undefined ? { parentTaskId } : {}),
                ...(cursor !== undefined ? { cursor: decodeTaskPageCursor(cursor) } : {}),
            };
            return telemetered(CHAT_TOOL.searchTasks, { limit }, async () => {
                const page = await deps.tasks.findVisiblePage(userId, filter);
                const items = page.map((view) => view.toListItem());
                const last = items.at(-1);
                const nextCursor =
                    items.length === limit && last !== undefined
                        ? encodeTaskPageCursor({ updatedAt: last.updatedAt, id: last.id })
                        : null;
                return JSON.stringify({ items, nextCursor });
            });
        },

        [CHAT_TOOL.getTask]: async (raw) => {
            const taskId = str(parseChatToolArgs(CHAT_TOOL.getTask, raw)["taskId"])!;
            return telemetered(CHAT_TOOL.getTask, { taskId }, async () => {
                const task = await deps.tasks.findById(taskId);
                if (task === null || task.userId !== userId) return notFound("Task", taskId);
                const [sessions, state] = await Promise.all([
                    deps.sessions.findByTask(taskId),
                    deps.taskUserStates.findById(taskId),
                ]);
                return JSON.stringify({
                    task: {
                        id: task.id,
                        userId: task.userId,
                        title: task.title,
                        slug: task.slug,
                        status: task.status,
                        taskKind: task.taskKind,
                        origin: task.origin,
                        workspacePath: task.workspacePath,
                        parentTaskId: task.parentTaskId,
                        archived: state?.isArchived() ?? false,
                        createdAt: task.createdAt.toISOString(),
                        updatedAt: task.updatedAt.toISOString(),
                        lastEventAt: task.lastEventAt?.toISOString() ?? null,
                    },
                    sessions: sessions.map(mapSession),
                    resumeTarget: resumeTarget(task, sessions),
                });
            });
        },

        [CHAT_TOOL.getTimeline]: async (raw) => {
            const a = parseChatToolArgs(CHAT_TOOL.getTimeline, raw);
            const taskId = str(a["taskId"])!;
            const limit = chatLimit(CHAT_TOOL.getTimeline, num(a["limit"]));
            const cursor = str(a["cursor"]);
            return telemetered(CHAT_TOOL.getTimeline, { taskId, limit }, async () => {
                const task = await deps.tasks.findById(taskId);
                if (task === null || task.userId !== userId) return notFound("Task", taskId);
                const rows = await deps.events.findTimeline(taskId, cursor !== undefined ? { seq: cursor } : undefined, limit + 1);
                const hasMore = rows.length > limit;
                const page = hasMore ? rows.slice(0, limit) : rows;
                const nextCursor = hasMore ? String(page.at(-1)!.seq) : null;
                return JSON.stringify({ items: page.map(mapEvent), nextCursor });
            });
        },

        [CHAT_TOOL.searchEvents]: async (raw) => {
            const a = parseChatToolArgs(CHAT_TOOL.searchEvents, raw);
            const limit = chatLimit(CHAT_TOOL.searchEvents, num(a["limit"]));
            const q = str(a["q"]);
            const taskId = str(a["taskId"]);
            const kind = str(a["kind"]);
            const lane = str(a["lane"]);
            const from = str(a["from"]);
            const to = str(a["to"]);
            return telemetered(CHAT_TOOL.searchEvents, { limit }, async () => {
                const items = await deps.search.search({
                    userId,
                    limit,
                    ...(q !== undefined ? { q } : {}),
                    ...(taskId !== undefined ? { taskId } : {}),
                    ...(kind !== undefined ? { kind } : {}),
                    ...(lane !== undefined ? { lane } : {}),
                    ...(from !== undefined ? { from } : {}),
                    ...(to !== undefined ? { to } : {}),
                });
                return JSON.stringify({ items });
            });
        },

        [CHAT_TOOL.listMemos]: async (raw) => {
            const a = parseChatToolArgs(CHAT_TOOL.listMemos, raw);
            const taskId = str(a["taskId"]);
            const eventId = str(a["eventId"]);
            return telemetered(CHAT_TOOL.listMemos, { taskId, eventId }, async () => {
                let rows;
                if (eventId !== undefined) {
                    rows = (await deps.memos.findByEvent(eventId)).filter(
                        (memo) => memo.userId === userId && (taskId === undefined || memo.taskId === taskId),
                    );
                } else if (taskId !== undefined) {
                    rows = await deps.memos.findByTask(userId, taskId);
                } else {
                    rows = await deps.memos.listAll(userId);
                }
                return JSON.stringify({ items: rows.map(mapMemo) });
            });
        },

        [CHAT_TOOL.listRules]: async (raw) => {
            const a = parseChatToolArgs(CHAT_TOOL.listRules, raw);
            const taskId = str(a["taskId"]);
            return telemetered(CHAT_TOOL.listRules, { taskId }, async () => {
                const rules =
                    taskId !== undefined
                        ? await deps.rules.findAllForListing(userId, taskId)
                        : await deps.rules.findAllByUser(userId);
                const verdicts = await deps.verdicts.findByRules(rules.map((rule) => rule.id));
                const byRule = new Map(verdicts.map((verdict) => [verdict.ruleId, verdict]));
                return JSON.stringify({ items: rules.map((rule) => mapRule(rule, byRule.get(rule.id))) });
            });
        },

        [CHAT_TOOL.getRuleEvidence]: async (raw) => {
            const a = parseChatToolArgs(CHAT_TOOL.getRuleEvidence, raw);
            const ruleId = str(a["ruleId"])!;
            const scopeTaskId = str(a["taskId"]);
            return telemetered(CHAT_TOOL.getRuleEvidence, { ruleId }, async () => {
                const rule = await deps.rules.findById(ruleId);
                if (rule === null || rule.userId !== userId) return notFound("Rule", ruleId);
                const [verdict, citedEvents] = await Promise.all([
                    deps.verdicts.findByRule(ruleId),
                    deps.events.findByIds(rule.citedEventIds),
                ]);
                return JSON.stringify({
                    taskId: scopeTaskId ?? rule.taskId,
                    ruleId,
                    anchorEventId: rule.anchorEventId,
                    status: verdict?.status ?? null,
                    expectation: rule.expectation,
                    evidence: verdict?.evidence ?? null,
                    citedEvents: citedEvents.map(mapEvent),
                });
            });
        },

        [CHAT_TOOL.listTags]: async (raw) => {
            parseChatToolArgs(CHAT_TOOL.listTags, raw);
            return telemetered(CHAT_TOOL.listTags, {}, async () => {
                const [tags, counts] = await Promise.all([deps.tags.listAll(userId), deps.taskTags.countByTag(userId)]);
                return JSON.stringify({ items: tags.map((tag) => mapTag(tag, counts[tag.id] ?? 0)) });
            });
        },

        [CHAT_TOOL.listRecipes]: async (raw) => {
            const status = str(parseChatToolArgs(CHAT_TOOL.listRecipes, raw)["status"]);
            return telemetered(CHAT_TOOL.listRecipes, { status }, async () => {
                const recipes =
                    status !== undefined
                        ? await deps.recipes.findByStatus(userId, status as RecipeStatus)
                        : await deps.recipes.findByUser(userId);
                const items = await Promise.all(
                    recipes.map(async (recipe) => mapRecipe(recipe, await deps.recipeApplications.findByRecipe(recipe.id))),
                );
                return JSON.stringify({ items });
            });
        },

        [CHAT_TOOL.listCleanupSuggestions]: async (raw) => {
            const status = str(parseChatToolArgs(CHAT_TOOL.listCleanupSuggestions, raw)["status"]);
            const statuses = (status !== undefined ? [status] : [...CLEANUP_SUGGESTION_STATUSES]) as TaskCleanupSuggestionStatus[];
            return telemetered(CHAT_TOOL.listCleanupSuggestions, { status }, async () => {
                const groups = await Promise.all(statuses.map((value) => deps.cleanupSuggestions.findByUserStatus(userId, value)));
                return JSON.stringify({ items: groups.flat().map(mapCleanup) });
            });
        },

        [CHAT_TOOL.getJob]: async (raw) => {
            const jobId = str(parseChatToolArgs(CHAT_TOOL.getJob, raw)["jobId"])!;
            return telemetered(CHAT_TOOL.getJob, { jobId }, async () => {
                const job = await deps.jobs.findById(jobId);
                if (job === null || job.userId !== userId) return notFound("Job", jobId);
                return JSON.stringify({ job: mapJob(job) });
            });
        },

        [CHAT_TOOL.listSettings]: async (raw) => {
            parseChatToolArgs(CHAT_TOOL.listSettings, raw);
            return telemetered(CHAT_TOOL.listSettings, {}, async () => {
                const settings = await deps.settings.findAllByScope(userId);
                return JSON.stringify({ items: settings.map(mapSetting) });
            });
        },
    };
}

function notFound(kind: string, id: string): string {
    return `${kind} ${id} not found.`;
}
