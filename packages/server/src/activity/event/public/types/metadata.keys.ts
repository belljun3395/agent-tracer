/**
 * Public re-export of the runtime metadata key registry. Cross-module consumers
 * (task openinference export) read TimelineEvent.metadata fields by these
 * canonical keys.
 */
export { META } from "~activity/event/domain/runtime/const/metadata.keys.const.js";
