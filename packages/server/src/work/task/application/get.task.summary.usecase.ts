import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { TaskQueryService } from "../service/task.query.service.js";
import type {
    GetTaskSummaryUseCaseIn,
    GetTaskSummaryUseCaseOut,
    TaskSummaryCommandDto,
    TaskSummaryFileDto,
    TaskSummaryToolCountDto,
} from "./dto/get.task.summary.usecase.dto.js";

const MAX_TOP_FILES = 5;
const MAX_TOP_COMMANDS = 10;
const MAX_FIRST_MESSAGE_BODY = 4000;
const MAX_COMMAND_TEXT_LENGTH = 200;

interface CountRow {
    readonly count: number | string;
}

interface FirstUserMessageRow {
    readonly title: string;
    readonly body: string | null;
}

interface ToolCountRow {
    readonly tool: string | null;
    readonly count: number | string;
}

interface FileTouchRow {
    readonly path: string;
    readonly touches: number | string;
}

interface CommandCountRow {
    readonly command: string | null;
    readonly count: number | string;
}

/**
 * Summary generation is a hot governance-agent preflight path. Keep the business
 * meaning in this use case, but fetch only the aggregate facts it needs instead
 * of hydrating every timeline event and all derived-table supplements.
 */
@Injectable()
export class GetTaskSummaryUseCase {
    constructor(
        private readonly query: TaskQueryService,
        private readonly dataSource: DataSource,
    ) {}

    async execute(input: GetTaskSummaryUseCaseIn): Promise<GetTaskSummaryUseCaseOut> {
        const task = await this.query.findById(input.taskId);
        if (!task) return { summary: null };

        const [eventCount, firstUserMessage, toolCounts, topFiles, topCommands] = await Promise.all([
            this.countEvents(task.id),
            this.findFirstUserMessage(task.id),
            this.findToolCounts(task.id),
            this.findTopFiles(task.id),
            this.findTopCommands(task.id),
        ]);

        return {
            summary: {
                id: task.id,
                title: task.displayTitle ?? task.title,
                status: task.status,
                ...(task.workspacePath ? { workspacePath: task.workspacePath } : {}),
                createdAt: task.createdAt,
                updatedAt: task.updatedAt,
                ...(firstUserMessage ? { firstUserMessage } : {}),
                eventCount,
                toolCounts,
                topFiles,
                topCommands,
            },
        };
    }

    private async countEvents(taskId: string): Promise<number> {
        const rows = await this.dataSource.query<readonly CountRow[]>(
            `select count(*) as count
             from timeline_events_view
             where task_id = ?`,
            [taskId],
        );
        return toNumber(rows[0]?.count);
    }

    private async findFirstUserMessage(taskId: string): Promise<{ title: string; body?: string } | undefined> {
        const rows = await this.dataSource.query<readonly FirstUserMessageRow[]>(
            `select title, body
             from timeline_events_view
             where task_id = ? and kind = 'user.message'
             order by created_at asc
             limit 1`,
            [taskId],
        );
        const row = rows[0];
        if (!row) return undefined;
        return {
            title: truncate(row.title, 200),
            ...(row.body ? { body: truncate(row.body, MAX_FIRST_MESSAGE_BODY) } : {}),
        };
    }

    private async findToolCounts(taskId: string): Promise<readonly TaskSummaryToolCountDto[]> {
        const rows = await this.dataSource.query<readonly ToolCountRow[]>(
            `select tool, count(*) as count
             from (
               select case
                 when tool_name is not null and trim(tool_name) != '' then tool_name
                 when source_tool is not null and trim(source_tool) != '' then source_tool
                 when kind = 'terminal.command' then 'Bash'
                 when kind = 'tool.used' then json_extract(extras_json, '$.tool')
                 else null
               end as tool
               from timeline_events_view
               where task_id = ?
             )
             where tool is not null and trim(tool) != ''
             group by tool
             order by count(*) desc`,
            [taskId],
        );
        return rows.map((row) => ({ tool: row.tool ?? "", count: toNumber(row.count) }));
    }

    private async findTopFiles(taskId: string): Promise<readonly TaskSummaryFileDto[]> {
        const rows = await this.dataSource.query<readonly FileTouchRow[]>(
            `select ef.file_path as path, count(*) as touches
             from event_files ef
             join timeline_events_view e on e.id = ef.event_id
             where e.task_id = ?
             group by ef.file_path
             order by count(*) desc, ef.file_path asc
             limit ?`,
            [taskId, MAX_TOP_FILES],
        );
        return rows.map((row) => ({ path: row.path, touches: toNumber(row.touches) }));
    }

    private async findTopCommands(taskId: string): Promise<readonly TaskSummaryCommandDto[]> {
        const rows = await this.dataSource.query<readonly CommandCountRow[]>(
            `select command, count(*) as count
             from (
               select case
                 when length(trim(json_extract(extras_json, '$.command'))) > ?
                   then substr(trim(json_extract(extras_json, '$.command')), 1, ?) || '...'
                 else trim(json_extract(extras_json, '$.command'))
               end as command
               from timeline_events_view
               where task_id = ?
             )
             where command is not null and command != ''
             group by command
             order by count(*) desc, command asc
             limit ?`,
            [MAX_COMMAND_TEXT_LENGTH, MAX_COMMAND_TEXT_LENGTH, taskId, MAX_TOP_COMMANDS],
        );
        return rows.map((row) => ({ command: row.command ?? "", count: toNumber(row.count) }));
    }
}

function toNumber(value: number | string | undefined): number {
    if (typeof value === "number") return value;
    if (typeof value === "string") return Number(value);
    return 0;
}

function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max) + "...";
}
