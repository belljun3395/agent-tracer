export const GUIDANCE_LOCALES = Object.freeze(["en", "ko"] as const);

export type GuidanceLocale = (typeof GUIDANCE_LOCALES)[number];

export const DEFAULT_GUIDANCE_LOCALE: GuidanceLocale = "en";

export function isGuidanceLocale(value: unknown): value is GuidanceLocale {
  return value === "en" || value === "ko";
}

export function normalizeGuidanceLocale(value: unknown): GuidanceLocale {
  return isGuidanceLocale(value) ? value : DEFAULT_GUIDANCE_LOCALE;
}
