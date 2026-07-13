import {
  DEFAULT_GUIDANCE_LOCALE,
  normalizeGuidanceLocale,
  type GuidanceLocale,
} from "~web/shared/guidance.js";

export interface GuidanceLocaleSlice {
  readonly guidanceLocale: GuidanceLocale;
  readonly setGuidanceLocale: (locale: GuidanceLocale) => void;
}

type SetState = (
  partial:
    | Partial<GuidanceLocaleSlice>
    | ((state: GuidanceLocaleSlice) => Partial<GuidanceLocaleSlice>),
) => void;

export function createGuidanceLocaleSlice(
  set: SetState,
): GuidanceLocaleSlice {
  return {
    guidanceLocale: DEFAULT_GUIDANCE_LOCALE,
    setGuidanceLocale: (guidanceLocale) =>
      set({ guidanceLocale: normalizeGuidanceLocale(guidanceLocale) }),
  };
}
