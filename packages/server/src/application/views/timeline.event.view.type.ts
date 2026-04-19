import type { TimelineEvent } from "~domain/index.js";
import type { EventSemanticView } from "./event.semantic.type.js";

export interface TimelineEventRecordPaths {
    readonly primaryPath?: string;
    readonly filePaths: readonly string[];
    readonly mentionedPaths: readonly string[];
}

export interface TimelineEventRecord extends TimelineEvent {
    readonly semantic?: EventSemanticView;
    readonly paths: TimelineEventRecordPaths;
}
