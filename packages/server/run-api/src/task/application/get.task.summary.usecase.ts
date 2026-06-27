import { Injectable } from "@nestjs/common";
import { KIND } from "@monitor/timeline-api/event/public/types/event.const.js";
import { TaskQueryService } from "../service/task.query.service.js";
import { GetTaskTimelineUseCase } from "./get.task.timeline.usecase.js";
import type {
    GetTaskSummaryUseCaseIn,
    GetTaskSummaryUseCaseOut,
    TaskSummaryCommandDto,
    TaskSummaryFileDto,
    TaskSummaryToolCountDto,
} from "./dto/get.task.summary.usecase.dto.js";
import type { TimelineEventProjection } from "@monitor/timeline-api/event/public/dto/timeline.event.dto.js";

const MAX_TOP_FILES = 5;
const MAX_TOP_COMMANDS = 10;
const MAX_FIRST_MESSAGE_BODY = 4000;
const MAX_COMMAND_TEXT_LENGTH = 200;

@Injectable()
export class GetTaskSummaryUseCase {
    constructor(
        private readonly query: TaskQueryService,
        private readonly getTimeline: GetTaskTimelineUseCase,
    ) {}

    async execute(input: GetTaskSummaryUseCaseIn): Promise<GetTaskSummaryUseCaseOut> {
        const task = await this.query.findById(input.taskId);
        // 대상 태스크가 없으면 요약도 없다는 응답으로 정리한다.
        if (!task) return { summary: null };

        const timelineResult = await this.getTimeline.execute({ taskId: task.id });
        const events = timelineResult.timeline;

        const toolCounts = new Map<string, number>();
        const fileCounts = new Map<string, number>();
        const commandCounts = new Map<string, number>();
        let firstUserMessage: { title: string; body?: string } | undefined;

        for (const event of events) {
            if (!firstUserMessage && event.kind === KIND.userMessage) {
                // 최초 사용자 메시지는 룰/레시피 생성의 의도 근거로 한 번만 보존한다.
                firstUserMessage = {
                    title: truncate(event.title, 200),
                    ...(event.body
                        ? { body: truncate(event.body, MAX_FIRST_MESSAGE_BODY) }
                        : {}),
                };
            }

            const tool = inferToolName(event);
            if (tool) {
                // 도구명은 사용 빈도순 요약을 만들기 위해 카운트한다.
                toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + 1);
            }

            for (const file of collectFilePaths(event)) {
                fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
            }

            const command = readString(event.metadata, "command");
            if (command) {
                // 명령 문자열은 길이를 제한해 요약 데이터가 과도하게 커지지 않게 한다.
                const normalized = truncate(command.trim(), MAX_COMMAND_TEXT_LENGTH);
                commandCounts.set(normalized, (commandCounts.get(normalized) ?? 0) + 1);
            }
        }

        const toolCountList: TaskSummaryToolCountDto[] = Array.from(toolCounts.entries())
            .map(([tool, count]) => ({ tool, count }))
            .sort((a, b) => b.count - a.count);

        const topFiles: TaskSummaryFileDto[] = Array.from(fileCounts.entries())
            .map(([path, touches]) => ({ path, touches }))
            .sort((a, b) => b.touches - a.touches)
            .slice(0, MAX_TOP_FILES);

        const topCommands: TaskSummaryCommandDto[] = Array.from(commandCounts.entries())
            .map(([command, count]) => ({ command, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, MAX_TOP_COMMANDS);

        return {
            summary: {
                id: task.id,
                title: task.displayTitle ?? task.title,
                status: task.status,
                ...(task.workspacePath ? { workspacePath: task.workspacePath } : {}),
                createdAt: task.createdAt,
                updatedAt: task.updatedAt,
                ...(firstUserMessage ? { firstUserMessage } : {}),
                eventCount: events.length,
                toolCounts: toolCountList,
                topFiles,
                topCommands,
            },
        };
    }
}

function inferToolName(event: TimelineEventProjection): string | null {
    const explicit = readString(event.metadata, "toolName")
        ?? readString(event.metadata, "sourceTool");
    // 명시 도구명이 있으면 이벤트 kind보다 우선한다.
    if (explicit) return explicit;
    if (event.kind === KIND.terminalCommand) return "Bash";
    if (event.kind === KIND.toolUsed) return readString(event.metadata, "tool") ?? null;
    return null;
}

function collectFilePaths(event: TimelineEventProjection): readonly string[] {
    const paths = event.paths.filePaths;
    // 여러 파일 경로가 있으면 대표 경로보다 전체 목록을 우선한다.
    if (paths.length > 0) return paths;
    const primary = event.paths.primaryPath;
    return primary ? [primary] : [];
}

function readString(meta: Record<string, unknown>, key: string): string | undefined {
    const v = meta[key];
    return typeof v === "string" && v.trim() ? v : undefined;
}

function truncate(text: string, max: number): string {
    // 상한 이하면 원문을 유지하고, 넘는 텍스트만 잘라 요약 데이터 크기를 제한한다.
    if (text.length <= max) return text;
    return text.slice(0, max) + "...";
}
