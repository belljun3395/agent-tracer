import { PLAYBOOK_STATUSES } from "./playbook.const.js";
import type { PlaybookStatus } from "./playbook.type.js";

export * from "./playbook.const.js";
export type * from "./playbook.type.js";
export type * from "./playbook.model.js";

const PLAYBOOK_STATUS_SET = new Set<string>(PLAYBOOK_STATUSES);

export function isPlaybookStatus(value: string | undefined): value is PlaybookStatus {
    return value !== undefined && PLAYBOOK_STATUS_SET.has(value);
}
