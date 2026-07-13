import type { EventEntity } from "./event.entity.js";
import {
    EVIDENCE_LEVELS,
    META,
    SUBTYPE_REGISTRY,
    isEventSubtypeGroup,
    isEventSubtypeKey,
    isEventToolFamily,
    type EvidenceLevel,
    type TimelineItemDto,
    type TimelineItemSubtype,
} from "./event.const.js";

const EVIDENCE_LEVEL_SET = new Set<string>(EVIDENCE_LEVELS);

function readString(metadata: Record<string, unknown>, key: string): string | undefined {
    const value = metadata[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readStringArray(metadata: Record<string, unknown>, key: string): string[] {
    const value = metadata[key];
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === "string");
}

// 이벤트의 표시 세부 유형·제목·근거 수준·경로를 읽기 시점에 파생한다(저장하지 않는다).
export class EventPresentation {
    constructor(private readonly event: EventEntity) {}

    private subtype(): TimelineItemSubtype | undefined {
        const key = readString(this.event.metadata, META.subtypeKey);
        if (!isEventSubtypeKey(key)) return undefined;
        const registry = SUBTYPE_REGISTRY[key];
        const group = readString(this.event.metadata, META.subtypeGroup);
        const toolFamily = readString(this.event.metadata, META.toolFamily);
        const sourceTool = readString(this.event.metadata, META.sourceTool);
        const entityType = readString(this.event.metadata, META.entityType);
        const entityName = readString(this.event.metadata, META.entityName);
        return {
            key,
            label: readString(this.event.metadata, META.subtypeLabel) ?? registry.label,
            group: isEventSubtypeGroup(group) ? group : registry.group,
            toolFamily: isEventToolFamily(toolFamily) ? toolFamily : registry.toolFamily,
            operation: readString(this.event.metadata, META.operation) ?? registry.operation,
            ...(sourceTool !== undefined ? { sourceTool } : {}),
            ...(entityType !== undefined ? { entityType } : {}),
            ...(entityName !== undefined ? { entityName } : {}),
        };
    }

    private displayTitle(): string {
        return readString(this.event.metadata, META.displayTitle) ?? this.event.title;
    }

    private evidenceLevel(): EvidenceLevel | undefined {
        const level = readString(this.event.metadata, META.evidenceLevel);
        return level !== undefined && EVIDENCE_LEVEL_SET.has(level) ? (level as EvidenceLevel) : undefined;
    }

    private filePaths(): string[] {
        return [...new Set([...this.event.filePaths, ...readStringArray(this.event.metadata, META.filePaths)])];
    }

    toTimelineItem(): TimelineItemDto {
        const subtype = this.subtype();
        const evidenceLevel = this.evidenceLevel();
        return {
            id: this.event.id,
            seq: this.event.seq,
            taskId: this.event.taskId,
            ...(this.event.sessionId !== null ? { sessionId: this.event.sessionId } : {}),
            ...(this.event.turnId !== null ? { turnId: this.event.turnId } : {}),
            kind: this.event.kind,
            lane: this.event.lane,
            title: this.event.title,
            displayTitle: this.displayTitle(),
            ...(this.event.body !== null ? { body: this.event.body } : {}),
            ...(this.event.toolName !== null ? { toolName: this.event.toolName } : {}),
            filePaths: this.filePaths(),
            metadata: this.event.metadata,
            occurredAt: this.event.occurredAt.toISOString(),
            ...(subtype !== undefined ? { subtype } : {}),
            ...(evidenceLevel !== undefined ? { evidenceLevel } : {}),
        };
    }
}
