import { resolveSemanticView, resolveTimelineEventPaths, type TimelineEvent } from "~domain/index.js";
import type { IEventRepository } from "../ports/index.js";
import type {
    GetTaskTimelineUseCaseIn,
    GetTaskTimelineUseCaseOut,
    TimelineEventUseCaseDto,
} from "./dto/get.task.timeline.usecase.dto.js";

export class GetTaskTimelineUseCase {
    constructor(private readonly eventRepo: IEventRepository) {}
    async execute(input: GetTaskTimelineUseCaseIn): Promise<GetTaskTimelineUseCaseOut> {
        const timeline = await this.eventRepo.findByTaskId(input.taskId);
        return { timeline: timeline.map(toTimelineEventUseCaseDto) };
    }
}

function toTimelineEventUseCaseDto(event: TimelineEvent): TimelineEventUseCaseDto {
    const semantic = resolveSemanticView(event);
    const paths = resolveTimelineEventPaths(event);

    return {
        id: event.id,
        taskId: event.taskId,
        ...(event.sessionId !== undefined ? { sessionId: event.sessionId } : {}),
        kind: event.kind,
        lane: event.lane,
        title: event.title,
        ...(event.body !== undefined ? { body: event.body } : {}),
        metadata: event.metadata,
        classification: event.classification,
        createdAt: event.createdAt,
        ...(semantic ? {
            semantic: {
                subtypeKey: semantic.subtypeKey,
                subtypeLabel: semantic.subtypeLabel,
                ...(semantic.subtypeGroup !== undefined ? { subtypeGroup: semantic.subtypeGroup } : {}),
                ...(semantic.entityType !== undefined ? { entityType: semantic.entityType } : {}),
                ...(semantic.entityName !== undefined ? { entityName: semantic.entityName } : {}),
            },
        } : {}),
        paths: {
            ...(paths.primaryPath !== undefined ? { primaryPath: paths.primaryPath } : {}),
            filePaths: paths.filePaths,
            mentionedPaths: paths.mentionedPaths,
        },
    };
}
