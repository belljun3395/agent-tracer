import type { TimelineEventWriteInput } from "@monitor/timeline-api/event/public/iservice/timeline.event.write.iservice.js";
import type { TimelineEventSnapshot } from "@monitor/timeline-api/event/public/dto/timeline.event.dto.js";

/**
 * 아웃바운드 포트 — 타임라인 이벤트 읽기/쓰기. 캐노니컬 이벤트 public 타입을 그대로
 * 사용해 캐스트 없이 정렬된다.
 */
export interface ITimelineEventAccess {
    insert(input: TimelineEventWriteInput): Promise<TimelineEventSnapshot>;
    findByTaskId(taskId: string): Promise<readonly TimelineEventSnapshot[]>;
    findById(id: string): Promise<TimelineEventSnapshot | null>;
    countAll(): Promise<number>;
}
