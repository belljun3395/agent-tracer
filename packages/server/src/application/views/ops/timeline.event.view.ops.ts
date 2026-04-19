import {
    isUserMessageEvent,
    META,
    readStringArray,
    type TimelineEvent,
} from "~domain/index.js";
import { normalizeFilePath } from "~domain/paths.utils.js";
import { resolveSemanticView } from "./event.semantic.ops.js";
import type { TimelineEventRecord } from "../timeline.event.view.type.js";

export type * from "../timeline.event.view.type.js";

export function mapTimelineEventToRecord(event: TimelineEvent): TimelineEventRecord {
    const filePaths = readStringArray(event.metadata, META.filePaths).map((filePath) => normalizeFilePath(filePath));
    const primaryPath = filePaths[0];
    const mentionedPaths = isUserMessageEvent(event) ? filePaths : [];
    const semantic = resolveSemanticView(event);

    return {
        ...event,
        ...(semantic ? { semantic } : {}),
        paths: {
            ...(primaryPath ? { primaryPath } : {}),
            filePaths,
            mentionedPaths,
        },
    };
}
