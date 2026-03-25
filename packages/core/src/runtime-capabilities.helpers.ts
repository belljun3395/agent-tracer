import { RUNTIME_CAPABILITIES_BY_ID } from "./runtime-capabilities.constants.js";
import type { RuntimeAdapterId, RuntimeCapabilities } from "./runtime-capabilities.types.js";

export function getRuntimeCapabilities(id: RuntimeAdapterId): RuntimeCapabilities {
  return RUNTIME_CAPABILITIES_BY_ID[id];
}

export function listNativeSkillPaths(id: RuntimeAdapterId): readonly string[] {
  return getRuntimeCapabilities(id).nativeSkillPaths;
}
