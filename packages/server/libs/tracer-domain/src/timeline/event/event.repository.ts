import { In, MoreThan, type Repository } from "typeorm";
import { KIND } from "@monitor/kernel";
import type { EventEntity } from "./event.entity.js";
import { upsertByKeys } from "@monitor/tracer-domain/persistence/repository.upsert.js";

export class EventRepository {
    constructor(private readonly repo: Repository<EventEntity>) {}

    async findTimeline(taskId: string, cursor: { seq: string } | undefined, limit: number): Promise<EventEntity[]> {
        return this.repo.find({
            where: { taskId, ...(cursor !== undefined ? { seq: MoreThan(cursor.seq) } : {}) },
            order: { seq: "ASC" },
            take: limit,
        });
    }

    // 타임라인 캐시 윈도잉(꼬리 우선 로딩)용 키셋 페이지이며, seq가 원장 BIGSERIAL로 전역 단조 유일값이라 단일 컬럼 커서로 충분하고, 반환은 seq DESC이며 화면 표시 순서로 뒤집는 것은 호출자 책임이다.
    async findTimelineWindow(taskId: string, cursor: string | undefined, limit: number): Promise<EventEntity[]> {
        const qb = this.repo
            .createQueryBuilder("e")
            .where("e.task_id = :taskId", { taskId })
            .orderBy("e.seq", "DESC")
            .limit(limit);
        if (cursor !== undefined) {
            qb.andWhere("e.seq < :cursor", { cursor });
        }
        return qb.getMany();
    }

    async findByTurn(turnId: string): Promise<EventEntity[]> {
        return this.repo.find({ where: { turnId }, order: { seq: "ASC" } });
    }

    // anchor된 규칙의 판정 창으로 근거가 된 사용자 입력부터 태스크의 현재 끝까지를 주며, 판정이 그 입력 이후의 이행 여부이므로 턴 경계로 자르지 않는다.
    async findByTaskSinceEvent(taskId: string, anchorEventId: string): Promise<EventEntity[]> {
        return this.repo
            .createQueryBuilder("e")
            .where("e.task_id = :taskId", { taskId })
            .andWhere("e.seq >= (SELECT a.seq FROM events a WHERE a.id = :anchorEventId)", { anchorEventId })
            .orderBy("e.seq", "ASC")
            .getMany();
    }

    // 레시피 적용의 판정 창이며 anchor는 events 테이블에 없는 원장 이벤트라 seq 비교로 직접 연다.
    async findByTaskSinceSeq(taskId: string, seq: string): Promise<EventEntity[]> {
        return this.repo
            .createQueryBuilder("e")
            .where("e.task_id = :taskId", { taskId })
            .andWhere("e.seq >= :seq", { seq })
            .orderBy("e.seq", "ASC")
            .getMany();
    }

    // anchor된 규칙의 판정 창의 현재 끝(최대 seq)이며 anchor가 원장에 없어 창이 비면 null이다.
    async maxSeqSinceEvent(taskId: string, anchorEventId: string): Promise<string | null> {
        const row = await this.repo
            .createQueryBuilder("e")
            .select("MAX(e.seq)", "maxSeq")
            .where("e.task_id = :taskId", { taskId })
            .andWhere("e.seq >= (SELECT a.seq FROM events a WHERE a.id = :anchorEventId)", { anchorEventId })
            .getRawOne<{ maxSeq: string | null }>();
        return row?.maxSeq ?? null;
    }

    // 규칙 생성의 근거로 고를 수 있는 사용자 입력들이며 오래된 것부터 준다.
    async findUserMessagesByTask(taskId: string): Promise<EventEntity[]> {
        return this.repo.find({
            where: { taskId, kind: KIND.userMessage },
            order: { seq: "ASC" },
        });
    }

    async findUserMessages(userId: string, limit: number): Promise<EventEntity[]> {
        return this.repo.find({
            where: { userId, kind: KIND.userMessage },
            order: { occurredAt: "ASC" },
            take: limit,
        });
    }

    async findByIds(ids: readonly string[]): Promise<EventEntity[]> {
        if (ids.length === 0) return [];
        return this.repo.find({ where: { id: In(ids) } });
    }

    // 페이지 하나가 잘라낸 부분집합인지 판단할 전체 개수이며, 페이지 쿼리와 분리해 상한 없이 센다.
    async countByTask(taskId: string): Promise<number> {
        return this.repo.count({ where: { taskId } });
    }

    async upsertAll(events: EventEntity[]): Promise<void> {
        if (events.length === 0) return;
        await upsertByKeys(this.repo, events, ["id"]);
    }
}
