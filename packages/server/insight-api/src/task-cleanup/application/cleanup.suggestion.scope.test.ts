import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { ListCleanupSuggestionsUseCase } from "./list.cleanup.suggestions.usecase.js";
import { AcceptCleanupSuggestionUseCase } from "./accept.cleanup.suggestion.usecase.js";
import type { TaskCleanupSuggestionRepository } from "../repository/task.cleanup.suggestion.repository.js";
import type { ITaskMaintenance } from "@monitor/run-api/public/task/iservice/task.maintenance.iservice.js";

describe("task-cleanup ownership scope", () => {
    it("list scopes pending suggestions to the current user", async () => {
        const suggestions = {
            listByStatus: vi.fn(async () => []),
            listAll: vi.fn(async () => []),
        } as unknown as TaskCleanupSuggestionRepository & { listByStatus: Mock; listAll: Mock };
        const uc = new ListCleanupSuggestionsUseCase(suggestions);

        await uc.execute({});

        expect(suggestions.listByStatus).toHaveBeenCalledWith("pending", "local");
    });

    it("accept scopes the suggestion lookup to the current user (cross-user is not_found)", async () => {
        const suggestions = {
            findOwned: vi.fn(async () => null),
            markResolved: vi.fn(async () => undefined),
        } as unknown as TaskCleanupSuggestionRepository & { findOwned: Mock; markResolved: Mock };
        const tasks = {} as ITaskMaintenance;
        const uc = new AcceptCleanupSuggestionUseCase(suggestions, tasks);

        const result = await uc.execute({ suggestionId: "s-1" });

        expect(result).toEqual({ status: "not_found" });
        expect(suggestions.findOwned).toHaveBeenCalledWith("s-1", "local");
        expect(suggestions.markResolved).not.toHaveBeenCalled();
    });
});
