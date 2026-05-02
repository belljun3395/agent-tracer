import type { TimelineEventRecord } from "~domain/monitoring.js";

export function extractMetadataString(metadata: Record<string, unknown>, key: string): string | undefined {
    const value = metadata[key];
    return typeof value === "string" ? value : undefined;
}

export function extractMetadataBoolean(metadata: Record<string, unknown>, key: string): boolean {
    return metadata[key] === true;
}

export function extractMetadataStringArray(metadata: Record<string, unknown>, key: string): readonly string[] {
    const value = metadata[key];
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((entry): entry is string => typeof entry === "string");
}

export function isCompactEvent(event: TimelineEventRecord): boolean {
    return event.classification.tags.includes("compact")
        || extractMetadataBoolean(event.metadata, "compactEvent")
        || Boolean(extractMetadataString(event.metadata, "compactPhase"))
        || Boolean(extractMetadataString(event.metadata, "compactEventType"));
}

export function countCompactions(timeline: readonly TimelineEventRecord[]): number {
    return timeline.filter(
        (e) => e.kind === "context.saved" && e.metadata["compactPhase"] === "before"
    ).length;
}
