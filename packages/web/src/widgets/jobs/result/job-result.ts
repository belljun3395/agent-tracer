import type { JobDto } from "@monitor/kernel";
import { JOB_KIND } from "~web/entities/job/model/job.js";
import type { JobFeedbackSubject } from "~web/features/job-feedback/job-feedback.js";

export interface TitleSuggestion {
  readonly title: string;
  readonly rationale: string;
}

export function feedbackSubject(kind: JobDto["kind"]): JobFeedbackSubject {
  switch (kind) {
    case JOB_KIND.titleSuggestion:
      return "title";
    case JOB_KIND.recipeScan:
      return "recipe";
    case JOB_KIND.ruleGeneration:
      return "rule";
    case JOB_KIND.taskCleanup:
      return "result";
  }
}

export function readTitleSuggestions(job: JobDto): readonly TitleSuggestion[] {
  const raw = job.result["suggestions"];
  return Array.isArray(raw) ? raw.filter(isTitleSuggestion) : [];
}

function isTitleSuggestion(value: unknown): value is TitleSuggestion {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate["title"] === "string"
    && typeof candidate["rationale"] === "string";
}
