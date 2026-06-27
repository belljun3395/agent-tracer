import type {
    TimelineEventProjection,
    TimelineEventSnapshot,
} from "@monitor/activity/event/public/dto/timeline.event.dto.js";

/**
 * 아웃바운드 포트 — 타임라인 이벤트를 WS 알림용 프로젝션으로 변환한다.
 * 캐노니컬 이벤트 public 타입을 그대로 사용해 캐스트 없이 정렬된다.
 */
export type ProjectableTimelineEvent = TimelineEventSnapshot;
export type ProjectedTimelineEvent = TimelineEventProjection;

export interface IEventProjectionAccess {
    project(event: ProjectableTimelineEvent): ProjectedTimelineEvent;
}
