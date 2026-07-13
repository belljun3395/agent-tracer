import { isTerminalCommand } from "@monitor/kernel";
import { isUserMessageEvent, type RecipeSlimEvent } from "./recipe.event.model.js";

const TOP_TOOLS = 12;
const TOP_FILES = 12;
const TOP_COMMANDS = 12;

/** 요약이 보는 태스크의 순수 표현이다. */
export interface TaskSnapshot {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly taskKind: string;
    readonly workspacePath?: string;
    readonly createdAt: string;
    readonly updatedAt: string;
}

/** 명령 판정에 필요한 원시 속성까지 실은 요약 입력 이벤트다. */
export interface TaskSummaryEvent extends RecipeSlimEvent {
    readonly metadata: Readonly<Record<string, unknown>>;
}

export interface TaskSummaryMessage {
    readonly title: string;
    readonly body?: string;
}

/** 태스크와 이벤트에서 파생한 프롬프트용 요약이다. */
export interface TaskSummary {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly taskKind: string;
    readonly workspacePath?: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly firstUserMessage?: TaskSummaryMessage;
    readonly eventCount: number;
    readonly totalEventCount: number;
    readonly truncated: boolean;
    readonly toolCounts: readonly { readonly tool: string; readonly count: number }[];
    readonly topFiles: readonly { readonly path: string; readonly touches: number }[];
    readonly topCommands: readonly { readonly command: string; readonly count: number }[];
}

/** 태스크 하나와 그 이벤트 창으로 요약을 계산한다. */
export function buildTaskSummary(
    task: TaskSnapshot,
    events: readonly TaskSummaryEvent[],
    totalEventCount: number,
): TaskSummary {
    let firstUserMessage: TaskSummaryMessage | undefined;
    const toolCounts = new Map<string, number>();
    const fileCounts = new Map<string, number>();
    const commandCounts = new Map<string, number>();

    for (const event of events) {
        if (firstUserMessage === undefined && isUserMessageEvent(event)) {
            firstUserMessage = {
                title: event.title,
                ...(event.body !== undefined ? { body: event.body } : {}),
            };
        }
        if (event.toolName !== undefined) {
            toolCounts.set(event.toolName, (toolCounts.get(event.toolName) ?? 0) + 1);
        }
        for (const path of event.filePaths) {
            fileCounts.set(path, (fileCounts.get(path) ?? 0) + 1);
        }
        if (isTerminalCommand({ toolName: event.toolName ?? null, metadata: event.metadata })) {
            const command = event.title.trim();
            if (command.length > 0) commandCounts.set(command, (commandCounts.get(command) ?? 0) + 1);
        }
    }

    return {
        id: task.id,
        title: task.title,
        status: task.status,
        taskKind: task.taskKind,
        ...(task.workspacePath !== undefined ? { workspacePath: task.workspacePath } : {}),
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        ...(firstUserMessage !== undefined ? { firstUserMessage } : {}),
        eventCount: events.length,
        totalEventCount,
        truncated: totalEventCount > events.length,
        toolCounts: topEntries(toolCounts, TOP_TOOLS).map(([tool, count]) => ({ tool, count })),
        topFiles: topEntries(fileCounts, TOP_FILES).map(([path, touches]) => ({ path, touches })),
        topCommands: topEntries(commandCounts, TOP_COMMANDS).map(([command, count]) => ({ command, count })),
    };
}

function topEntries(counts: Map<string, number>, limit: number): [string, number][] {
    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, limit);
}
