/**
 * Public event-domain helpers — pure functions safe for cross-module use.
 */
export { normalizeLane } from "~event/domain/event.lane.js";
export { createEventRecordDraft } from "~event/domain/event.recording.js";
export { readFilePaths, readString } from "~event/domain/event.metadata.js";
