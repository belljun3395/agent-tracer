export {
  GUIDANCE_BUNDLES,
  selectGuidanceBundle,
  type GuidanceBundle,
} from "~web/shared/guidance-catalog.js";
export { EN_GUIDANCE, type GuidanceCatalog } from "~web/shared/guidance-en.js";
export { KO_GUIDANCE } from "~web/shared/guidance-ko.js";
export {
  DEFAULT_GUIDANCE_LOCALE,
  GUIDANCE_LOCALES,
  isGuidanceLocale,
  normalizeGuidanceLocale,
  type GuidanceLocale,
} from "~web/shared/guidance-locale.js";
export {
  createGuidanceMessage,
  guidanceCode,
  guidanceStrong,
  guidanceText,
  isGuidanceMessage,
  type GuidanceCodePart,
  type GuidanceMessage,
  type GuidanceMessagePart,
  type GuidanceStrongPart,
  type GuidanceTextPart,
} from "~web/shared/guidance-message.js";
