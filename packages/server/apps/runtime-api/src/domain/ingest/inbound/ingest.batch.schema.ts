import { z } from "zod";
import { parseIngestBatch } from "@monitor/kernel/ingest/ingest.schema.js";

// 봉투 오류만 400으로 매핑하고 개별 레코드 오류는 응답 본문에 담는다.
export const ingestBatchRequestSchema = z.unknown().transform((value, ctx) => {
    try {
        return parseIngestBatch(value);
    } catch (error) {
        if (error instanceof z.ZodError) {
            for (const issue of error.issues) ctx.addIssue(issue);
        } else {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid ingest batch" });
        }
        return z.NEVER;
    }
});
