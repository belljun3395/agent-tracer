import type { PLAYBOOK_STATUSES } from "./playbook.const.js";

export type PlaybookStatus = (typeof PLAYBOOK_STATUSES)[number];
