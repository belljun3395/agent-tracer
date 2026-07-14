import { Inject, Injectable } from "@nestjs/common";
import { TaskUserStateEntity } from "@monitor/tracer-domain";
import { CLOCK, type ClockPort } from "~tracer-api/domain/task/port/clock.port.js";
import { TASK_SEARCH_INDEX, type TaskSearchIndexPort } from "~tracer-api/domain/task/port/task.search.index.port.js";
import { TASK_USER_STATE_REPOSITORY, type TaskUserStateRepositoryPort } from "~tracer-api/domain/task/port/task.user.state.repository.port.js";

/** 사용자별 태스크 상태와 검색 색인의 정합성을 함께 갱신한다. */
@Injectable()
export class TaskUserStateService {
    constructor(
        @Inject(TASK_USER_STATE_REPOSITORY) private readonly states: TaskUserStateRepositoryPort,
        @Inject(TASK_SEARCH_INDEX) private readonly search: TaskSearchIndexPort,
        @Inject(CLOCK) private readonly clock: ClockPort,
    ) {}

    async archive(userId: string, taskId: string): Promise<void> {
        await this.mutate(userId, taskId, (state, now) => state.archive(now), { archived: true });
    }

    async unarchive(userId: string, taskId: string): Promise<void> {
        await this.mutate(userId, taskId, (state, now) => state.unarchive(now), { archived: false });
    }

    async hide(userId: string, taskId: string): Promise<void> {
        await this.mutate(userId, taskId, (state, now) => state.hide(now), { hidden: true });
    }

    async rename(userId: string, taskId: string, title: string): Promise<void> {
        await this.mutate(userId, taskId, (state, now) => state.rename(title, now), { title });
    }

    private async mutate(
        userId: string,
        taskId: string,
        apply: (state: TaskUserStateEntity, now: Date) => void,
        indexPatch: Record<string, unknown>,
    ): Promise<void> {
        const now = this.clock.now();
        const state = (await this.states.findById(taskId)) ?? TaskUserStateEntity.init(taskId, userId, now);
        apply(state, now);
        await this.states.save(state);
        await this.search.partialUpdate(taskId, indexPatch);
    }
}
