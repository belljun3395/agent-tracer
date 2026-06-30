import { BadRequestException } from "@nestjs/common";
import type {
    ListTasksArchivedScope,
    ListTasksOriginFilter,
} from "../../application/task/dto/list.tasks.usecase.dto.js";
import { ARCHIVED_SCOPES } from "../../public/task/iservice/task.snapshot.query.iservice.js";

export const LIST_TASKS_ARCHIVED_SCOPES = ARCHIVED_SCOPES satisfies readonly ListTasksArchivedScope[];
export const LIST_TASKS_ORIGIN_FILTERS = ["user", "server-sdk", "all"] as const satisfies readonly ListTasksOriginFilter[];

const ARCHIVED_SCOPE_SET: ReadonlySet<string> = new Set(LIST_TASKS_ARCHIVED_SCOPES);
const ORIGIN_FILTER_SET: ReadonlySet<string> = new Set(LIST_TASKS_ORIGIN_FILTERS);

export function parseListTasksArchivedScope(raw: string | undefined): ListTasksArchivedScope {
    const value = raw ?? "active";
    if (isListTasksArchivedScope(value)) return value;
    throw new BadRequestException(`archived must be one of: ${LIST_TASKS_ARCHIVED_SCOPES.join(", ")}`);
}

export function parseListTasksOriginFilter(raw: string | undefined): ListTasksOriginFilter {
    const value = raw ?? "all";
    if (isListTasksOriginFilter(value)) return value;
    throw new BadRequestException(`origin must be one of: ${LIST_TASKS_ORIGIN_FILTERS.join(", ")}`);
}

function isListTasksArchivedScope(value: string): value is ListTasksArchivedScope {
    return ARCHIVED_SCOPE_SET.has(value);
}

function isListTasksOriginFilter(value: string): value is ListTasksOriginFilter {
    return ORIGIN_FILTER_SET.has(value);
}
