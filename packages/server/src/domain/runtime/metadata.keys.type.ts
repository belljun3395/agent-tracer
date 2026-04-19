import type { META } from "./metadata.keys.const.js";

export type MetaKey = typeof META[keyof typeof META];
