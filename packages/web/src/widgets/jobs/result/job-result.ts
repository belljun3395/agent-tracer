import type { JobDto } from "@monitor/kernel";

export interface TitleSuggestion {
  readonly title: string;
  readonly rationale: string;
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
