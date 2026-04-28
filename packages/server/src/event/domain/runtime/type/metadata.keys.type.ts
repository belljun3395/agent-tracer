import type { META } from "../const/metadata.keys.const.js";

export type MetaKey = typeof META[keyof typeof META];
