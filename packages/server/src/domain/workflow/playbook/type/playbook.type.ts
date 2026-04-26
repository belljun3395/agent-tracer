import type { PLAYBOOK_STATUSES } from "../const/playbook.const.js";

export type PlaybookStatus = (typeof PLAYBOOK_STATUSES)[number];
