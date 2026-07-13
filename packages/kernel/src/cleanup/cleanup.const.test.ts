import { describe, expect, expectTypeOf, it } from "vitest";
import type { CleanupSuggestionDto } from "./cleanup.dto.js";
import {
    CLEANUP_SUGGESTION_STATUS,
    CLEANUP_SUGGESTION_STATUSES,
    TASK_CLEANUP_SUGGESTION_KIND,
    TASK_CLEANUP_SUGGESTION_KINDS,
    type TaskCleanupSuggestionKind,
    type TaskCleanupSuggestionStatus,
} from "./cleanup.const.js";

describe("cleanup 계약 어휘", () => {
    it("제안 종류와 상태 카탈로그를 외부 계약으로 고정한다", () => {
        expect(TASK_CLEANUP_SUGGESTION_KINDS).toEqual([
            TASK_CLEANUP_SUGGESTION_KIND.archive,
        ]);
        expect(CLEANUP_SUGGESTION_STATUSES).toEqual([
            CLEANUP_SUGGESTION_STATUS.pending,
            CLEANUP_SUGGESTION_STATUS.accepted,
            CLEANUP_SUGGESTION_STATUS.dismissed,
        ]);
    });

    it("DTO 필드를 계약 어휘로 제한한다", () => {
        expectTypeOf<CleanupSuggestionDto["kind"]>().toEqualTypeOf<TaskCleanupSuggestionKind>();
        expectTypeOf<CleanupSuggestionDto["status"]>().toEqualTypeOf<TaskCleanupSuggestionStatus>();
    });
});
