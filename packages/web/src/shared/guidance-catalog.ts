import { EN_GUIDANCE, type GuidanceCatalog } from "~web/shared/guidance-en.js";
import { KO_GUIDANCE } from "~web/shared/guidance-ko.js";
import {
  normalizeGuidanceLocale,
  type GuidanceLocale,
} from "~web/shared/guidance-locale.js";

export interface GuidanceBundle {
  readonly locale: GuidanceLocale;
  readonly messages: GuidanceCatalog;
}

const EN_GUIDANCE_BUNDLE: GuidanceBundle = Object.freeze({
  locale: "en",
  messages: EN_GUIDANCE,
});

const KO_GUIDANCE_BUNDLE: GuidanceBundle = Object.freeze({
  locale: "ko",
  messages: KO_GUIDANCE,
});

export const GUIDANCE_BUNDLES: Readonly<
  Record<GuidanceLocale, GuidanceBundle>
> = Object.freeze({
  en: EN_GUIDANCE_BUNDLE,
  ko: KO_GUIDANCE_BUNDLE,
});

export function selectGuidanceBundle(locale: unknown): GuidanceBundle {
  return GUIDANCE_BUNDLES[normalizeGuidanceLocale(locale)];
}
