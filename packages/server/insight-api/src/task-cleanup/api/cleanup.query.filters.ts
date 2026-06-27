import { BadRequestException } from "@nestjs/common";
import type { CleanupSuggestionStatusFilter } from "../application/dto/cleanup.usecase.dto.js";

export const CLEANUP_SUGGESTION_STATUS_FILTERS = ["pending", "all"] as const satisfies readonly CleanupSuggestionStatusFilter[];

const CLEANUP_SUGGESTION_STATUS_FILTER_SET: ReadonlySet<string> = new Set(CLEANUP_SUGGESTION_STATUS_FILTERS);

export function parseCleanupSuggestionStatusFilter(raw: string | undefined): CleanupSuggestionStatusFilter {
    const value = raw ?? "pending";
    if (isCleanupSuggestionStatusFilter(value)) return value;
    throw new BadRequestException(`status must be one of: ${CLEANUP_SUGGESTION_STATUS_FILTERS.join(", ")}`);
}

function isCleanupSuggestionStatusFilter(value: string): value is CleanupSuggestionStatusFilter {
    return CLEANUP_SUGGESTION_STATUS_FILTER_SET.has(value);
}
