import { describe, expect, it } from "vitest";
import { JOB_KIND } from "./job.const.js";
import { JOB_INPUT_SCHEMA_BY_KIND, jobInputSchemaFor } from "./job.input.schema.js";

describe("jobInputSchemaFor", () => {
    it("서버가 확정하는 jobId를 입력으로 받지 않는다", () => {
        for (const kind of Object.values(JOB_KIND)) {
            const parsed = jobInputSchemaFor(kind).safeParse({ jobId: "01OTHERJOB", taskId: "t1" });
            expect(parsed.success).toBe(false);
        }
    });

    it("종류별로 선언한 필드만 통과시킨다", () => {
        expect(JOB_INPUT_SCHEMA_BY_KIND[JOB_KIND.titleSuggestion].safeParse({ taskId: "t1" }).success).toBe(true);
        expect(JOB_INPUT_SCHEMA_BY_KIND[JOB_KIND.titleSuggestion].safeParse({ taskId: "t1", trigger: "session" }).success).toBe(false);
        expect(JOB_INPUT_SCHEMA_BY_KIND[JOB_KIND.recipeScan].safeParse({ taskId: "t1", trigger: "session" }).success).toBe(true);
    });

    it("태스크 정리는 taskId를 받지 않는다", () => {
        expect(JOB_INPUT_SCHEMA_BY_KIND[JOB_KIND.taskCleanup].safeParse({ filters: {} }).success).toBe(true);
        expect(JOB_INPUT_SCHEMA_BY_KIND[JOB_KIND.taskCleanup].safeParse({ taskId: "t1" }).success).toBe(false);
    });

    it("규칙 생성은 알려진 focus 값만 받는다", () => {
        expect(JOB_INPUT_SCHEMA_BY_KIND[JOB_KIND.ruleGeneration].safeParse({ taskId: "t1", focus: "recent" }).success).toBe(true);
        expect(JOB_INPUT_SCHEMA_BY_KIND[JOB_KIND.ruleGeneration].safeParse({ taskId: "t1", focus: "all" }).success).toBe(false);
    });
});
