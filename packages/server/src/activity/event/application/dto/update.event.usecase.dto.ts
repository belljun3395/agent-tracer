import type { TimelineEventProjection } from "~activity/event/public/dto/timeline.event.dto.js";

export interface UpdateEventUseCaseIn {
    readonly eventId: string;
    readonly displayTitle?: string | null;
}

/** 업데이트 결과는 캐노니컬 프로젝션(중복 선언 제거). */
export type UpdateEventUseCaseOut = TimelineEventProjection | null;
