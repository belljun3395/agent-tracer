import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CHAT_TOOL, MEMO_AUTHOR, USER_TITLE_RANK, type RuleSeverity, type TaskStatus } from "@monitor/kernel";
import { ruleExpectationSchema } from "@monitor/kernel/rule/proposal/rule.proposal.schema.js";
import type { TaskRepository } from "@monitor/tracer-domain";
import type { ChatToolExecutorRegistry } from "~tracer-api/domain/chat/port/chat.tool.executors.port.js";
import type { RenameTaskUseCase } from "~tracer-api/domain/task/application/command/rename.task.usecase.js";
import type { SetTaskStatusUseCase } from "~tracer-api/domain/task/application/command/set.task.status.usecase.js";
import type { ArchiveTaskUseCase } from "~tracer-api/domain/task/application/command/archive.task.usecase.js";
import type { UnarchiveTaskUseCase } from "~tracer-api/domain/task/application/command/unarchive.task.usecase.js";
import type { HideTaskUseCase } from "~tracer-api/domain/task/application/command/hide.task.usecase.js";
import type { CreateMemoUseCase } from "~tracer-api/domain/memo/application/command/create.memo.usecase.js";
import type { UpdateMemoUseCase } from "~tracer-api/domain/memo/application/command/update.memo.usecase.js";
import type { DeleteMemoUseCase } from "~tracer-api/domain/memo/application/command/delete.memo.usecase.js";
import type { CreateRuleUseCase } from "~tracer-api/domain/rule/application/command/create.rule.usecase.js";
import type { UpdateRuleUseCase } from "~tracer-api/domain/rule/application/command/update.rule.usecase.js";
import type { DeleteRuleUseCase } from "~tracer-api/domain/rule/application/command/delete.rule.usecase.js";
import type { ApproveRuleUseCase } from "~tracer-api/domain/rule/application/command/approve.rule.usecase.js";
import type { ReevaluateRuleUseCase } from "~tracer-api/domain/rule/application/command/reevaluate.rule.usecase.js";
import type { CreateTagUseCase } from "~tracer-api/domain/tag/application/command/create.tag.usecase.js";
import type { UpdateTagUseCase } from "~tracer-api/domain/tag/application/command/update.tag.usecase.js";
import type { DeleteTagUseCase } from "~tracer-api/domain/tag/application/command/delete.tag.usecase.js";
import type { SetTaskTagsUseCase } from "~tracer-api/domain/tag/application/command/set.task.tags.usecase.js";
import type { AcceptRecipeUseCase } from "~tracer-api/domain/recipe/application/command/accept.recipe.usecase.js";
import type { DismissRecipeUseCase } from "~tracer-api/domain/recipe/application/command/dismiss.recipe.usecase.js";
import type { RetireRecipeUseCase } from "~tracer-api/domain/recipe/application/command/retire.recipe.usecase.js";
import type { AcceptCleanupSuggestionUseCase } from "~tracer-api/domain/cleanup/application/command/accept.cleanup.suggestion.usecase.js";
import type { DismissCleanupSuggestionUseCase } from "~tracer-api/domain/cleanup/application/command/dismiss.cleanup.suggestion.usecase.js";
import type { PutSettingUseCase } from "~tracer-api/domain/settings/application/command/put.setting.usecase.js";
import type { DeleteSettingUseCase } from "~tracer-api/domain/settings/application/command/delete.setting.usecase.js";

/** 확인 게이트가 승인 시 실제 명령을 실행하려고 조립 근원에서 주입받는 명령 유스케이스와 소유권 확인용 태스크 읽기 모델이다. */
export interface ChatToolExecutorDeps {
    readonly tasks: TaskRepository;
    readonly renameTask: RenameTaskUseCase;
    readonly setTaskStatus: SetTaskStatusUseCase;
    readonly archiveTask: ArchiveTaskUseCase;
    readonly unarchiveTask: UnarchiveTaskUseCase;
    readonly hideTask: HideTaskUseCase;
    readonly createMemo: CreateMemoUseCase;
    readonly updateMemo: UpdateMemoUseCase;
    readonly deleteMemo: DeleteMemoUseCase;
    readonly createRule: CreateRuleUseCase;
    readonly updateRule: UpdateRuleUseCase;
    readonly deleteRule: DeleteRuleUseCase;
    readonly approveRule: ApproveRuleUseCase;
    readonly reevaluateRule: ReevaluateRuleUseCase;
    readonly createTag: CreateTagUseCase;
    readonly updateTag: UpdateTagUseCase;
    readonly deleteTag: DeleteTagUseCase;
    readonly setTaskTags: SetTaskTagsUseCase;
    readonly acceptRecipe: AcceptRecipeUseCase;
    readonly dismissRecipe: DismissRecipeUseCase;
    readonly retireRecipe: RetireRecipeUseCase;
    readonly acceptCleanup: AcceptCleanupSuggestionUseCase;
    readonly dismissCleanup: DismissCleanupSuggestionUseCase;
    readonly putSetting: PutSettingUseCase;
    readonly deleteSetting: DeleteSettingUseCase;
}

/** 도구 이름을 명령 유스케이스 호출에 잇는 실행자 레지스트리이며, 각 실행자가 인자를 유스케이스 입력으로 옮기고 소유권을 그 유스케이스가 강제한다. */
export function buildChatToolExecutors(deps: ChatToolExecutorDeps): ChatToolExecutorRegistry {
    return {
        [CHAT_TOOL.updateTask]: async (userId, args) => {
            const taskId = req(args, "taskId");
            // RenameTask/SetTaskStatus는 userId를 받지 않으므로 이 게이트가 태스크 소유를 직접 확인한다.
            const task = await deps.tasks.findById(taskId);
            if (task === null || task.userId !== userId) throw new NotFoundException("Task not found");
            const title = opt(args, "title");
            const status = opt(args, "status");
            const changes: string[] = [];
            if (title !== undefined) {
                await deps.renameTask.execute(taskId, title, USER_TITLE_RANK);
                changes.push(`title="${title}"`);
            }
            if (status !== undefined) {
                await deps.setTaskStatus.execute(taskId, status as TaskStatus);
                changes.push(`status=${status}`);
            }
            if (changes.length === 0) throw new BadRequestException("update_task needs title or status");
            return `Updated task ${taskId}: ${changes.join(", ")}.`;
        },
        [CHAT_TOOL.archiveTask]: async (userId, args) => {
            await deps.archiveTask.execute(userId, req(args, "taskId"));
            return `Archived task ${req(args, "taskId")}.`;
        },
        [CHAT_TOOL.unarchiveTask]: async (userId, args) => {
            await deps.unarchiveTask.execute(userId, req(args, "taskId"));
            return `Unarchived task ${req(args, "taskId")}.`;
        },
        [CHAT_TOOL.deleteTask]: async (userId, args) => {
            await deps.hideTask.execute(userId, req(args, "taskId"));
            return `Deleted task ${req(args, "taskId")}.`;
        },
        [CHAT_TOOL.createMemo]: async (userId, args) => {
            const taskId = req(args, "taskId");
            const eventId = opt(args, "eventId");
            await deps.createMemo.execute({
                userId,
                taskId,
                body: req(args, "body"),
                author: MEMO_AUTHOR.human,
                ...(eventId !== undefined ? { eventId } : {}),
            });
            return `Created a memo on task ${taskId}.`;
        },
        [CHAT_TOOL.updateMemo]: async (userId, args) => {
            const id = req(args, "memoId");
            await deps.updateMemo.execute({ userId, id, body: req(args, "body") });
            return `Updated memo ${id}.`;
        },
        [CHAT_TOOL.deleteMemo]: async (userId, args) => {
            const id = req(args, "memoId");
            await deps.deleteMemo.execute(userId, id);
            return `Deleted memo ${id}.`;
        },
        [CHAT_TOOL.createRule]: async (userId, args) => {
            const taskId = req(args, "taskId");
            const name = req(args, "name");
            const expectation = ruleExpectationSchema.parse(parseJson(req(args, "expectation")));
            const severity = opt(args, "severity") as RuleSeverity | undefined;
            const rationale = opt(args, "rationale");
            await deps.createRule.execute({
                userId,
                name,
                expectation,
                taskId,
                anchorEventId: req(args, "anchorEventId"),
                ...(severity !== undefined ? { severity } : {}),
                ...(rationale !== undefined ? { rationale } : {}),
            });
            return `Created rule "${name}" on task ${taskId}.`;
        },
        [CHAT_TOOL.updateRule]: async (userId, args) => {
            const id = req(args, "ruleId");
            const name = opt(args, "name");
            const rawExpectation = opt(args, "expectation");
            const severity = opt(args, "severity") as RuleSeverity | undefined;
            const rationale = opt(args, "rationale");
            await deps.updateRule.execute({
                userId,
                id,
                ...(name !== undefined ? { name } : {}),
                ...(rawExpectation !== undefined ? { expectation: ruleExpectationSchema.parse(parseJson(rawExpectation)) } : {}),
                ...(severity !== undefined ? { severity } : {}),
                ...(rationale !== undefined ? { rationale } : {}),
            });
            return `Updated rule ${id}.`;
        },
        [CHAT_TOOL.deleteRule]: async (userId, args) => {
            const id = req(args, "ruleId");
            await deps.deleteRule.execute(userId, id);
            return `Deleted rule ${id}.`;
        },
        [CHAT_TOOL.approveRule]: async (userId, args) => {
            const id = req(args, "ruleId");
            const { reevaluated } = await deps.approveRule.execute(userId, id);
            return `Approved rule ${id} and reevaluated ${reevaluated} event(s).`;
        },
        [CHAT_TOOL.reevaluateRule]: async (userId, args) => {
            const id = req(args, "ruleId");
            const { reevaluated } = await deps.reevaluateRule.execute(userId, id);
            return `Reevaluated rule ${id} over ${reevaluated} event(s).`;
        },
        [CHAT_TOOL.createTag]: async (userId, args) => {
            const name = req(args, "name");
            const color = opt(args, "color");
            const description = opt(args, "description");
            await deps.createTag.execute({
                userId,
                name,
                ...(color !== undefined ? { color } : {}),
                ...(description !== undefined ? { description } : {}),
            });
            return `Created tag "${name}".`;
        },
        [CHAT_TOOL.updateTag]: async (userId, args) => {
            const id = req(args, "tagId");
            const name = opt(args, "name");
            const color = opt(args, "color");
            const description = opt(args, "description");
            await deps.updateTag.execute({
                userId,
                id,
                ...(name !== undefined ? { name } : {}),
                ...(color !== undefined ? { color } : {}),
                ...(description !== undefined ? { description } : {}),
            });
            return `Updated tag ${id}.`;
        },
        [CHAT_TOOL.deleteTag]: async (userId, args) => {
            const id = req(args, "tagId");
            await deps.deleteTag.execute(userId, id);
            return `Deleted tag ${id}.`;
        },
        [CHAT_TOOL.setTaskTags]: async (userId, args) => {
            const taskId = req(args, "taskId");
            const tagIds = parseIdList(req(args, "tagIds"));
            await deps.setTaskTags.execute({ userId, taskId, tagIds });
            return `Set ${tagIds.length} tag(s) on task ${taskId}.`;
        },
        [CHAT_TOOL.acceptRecipe]: async (userId, args) => {
            const id = req(args, "recipeId");
            await deps.acceptRecipe.execute(userId, id);
            return `Accepted recipe ${id}.`;
        },
        [CHAT_TOOL.dismissRecipe]: async (userId, args) => {
            const id = req(args, "recipeId");
            await deps.dismissRecipe.execute(userId, id);
            return `Dismissed recipe ${id}.`;
        },
        [CHAT_TOOL.retireRecipe]: async (userId, args) => {
            const id = req(args, "recipeId");
            await deps.retireRecipe.execute(userId, id);
            return `Retired recipe ${id}.`;
        },
        [CHAT_TOOL.acceptCleanup]: async (userId, args) => {
            const id = req(args, "suggestionId");
            await deps.acceptCleanup.execute(userId, id);
            return `Accepted cleanup suggestion ${id}.`;
        },
        [CHAT_TOOL.dismissCleanup]: async (userId, args) => {
            const id = req(args, "suggestionId");
            await deps.dismissCleanup.execute(userId, id);
            return `Dismissed cleanup suggestion ${id}.`;
        },
        [CHAT_TOOL.upsertSetting]: async (userId, args) => {
            const key = req(args, "key");
            await deps.putSetting.execute(userId, key, req(args, "value"));
            return `Set setting ${key}.`;
        },
        [CHAT_TOOL.deleteSetting]: async (userId, args) => {
            const key = req(args, "key");
            await deps.deleteSetting.execute(userId, key);
            return `Cleared setting ${key}.`;
        },
    };
}

function req(args: Record<string, unknown>, key: string): string {
    const value = args[key];
    if (typeof value !== "string" || value.length === 0) throw new BadRequestException(`${key} is required`);
    return value;
}

function opt(args: Record<string, unknown>, key: string): string | undefined {
    const value = args[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseJson(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        throw new BadRequestException("expectation must be a JSON object");
    }
}

function parseIdList(raw: string): string[] {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) {
        const parsed = parseJson(trimmed);
        if (!Array.isArray(parsed)) throw new BadRequestException("tagIds must be a JSON array");
        return parsed.map((id) => String(id)).filter((id) => id.length > 0);
    }
    return trimmed.length > 0 ? trimmed.split(/[\s,]+/).filter((id) => id.length > 0) : [];
}
