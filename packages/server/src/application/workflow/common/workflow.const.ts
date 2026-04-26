export const BRIEFING_PURPOSES = ["continue", "handoff", "review", "reference"] as const;
export const BRIEFING_FORMATS = ["plain", "markdown", "xml", "system-prompt", "prompt"] as const;
export const PLAYBOOK_STATUSES = ["draft", "active", "archived"] as const;
export const WORKFLOW_RATINGS = ["good", "skip"] as const;

export type BriefingPurposeUseCaseDto = (typeof BRIEFING_PURPOSES)[number];
export type BriefingFormatUseCaseDto = (typeof BRIEFING_FORMATS)[number];
export type PlaybookStatusUseCaseDto = (typeof PLAYBOOK_STATUSES)[number];
export type WorkflowRatingUseCaseDto = (typeof WORKFLOW_RATINGS)[number];
