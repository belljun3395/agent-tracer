/**
 * Public event-domain helpers — pure functions safe for cross-module use.
 */
export { normalizeLane } from "~activity/event/domain/event.lane.js";
export { createEventRecordDraft } from "~activity/event/domain/event.recording.js";
export { readFilePaths, readString } from "~activity/event/domain/event.metadata.js";
