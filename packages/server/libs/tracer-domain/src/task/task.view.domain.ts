import type { TaskEntity } from "./task.entity.js";
import type { TaskUserStateEntity } from "./user-state/task.user.state.entity.js";
import type { TaskListItemDto } from "./task.const.js";

// task 프로젝션과 사용자 결정(state)을 합쳐 표시값을 만든다.
export class TaskView {
    constructor(
        private readonly task: TaskEntity,
        private readonly state: TaskUserStateEntity | null,
    ) {}

    visibleTitle(): string {
        const custom = this.state?.customTitle;
        return custom !== null && custom !== undefined && custom.length > 0 ? custom : this.task.title;
    }

    isArchived(): boolean {
        return this.state?.isArchived() ?? false;
    }

    isVisible(): boolean {
        return !(this.state?.isHidden() ?? false);
    }

    // 보관 여부는 자격에 넣지 않으며, 보관은 정리했다는 뜻이지 재사용할 수 없다는 뜻이 아니다.
    isRecipeScanEligible(): boolean {
        return this.isVisible() && this.task.isRecipeScanAnchor();
    }

    // 숨김은 두 경로 모두에서 자격을 뺏으며, 사용자가 보이지 않기로 한 작업이다.
    isSessionRecipeScanEligible(): boolean {
        return this.isVisible() && this.task.isSessionRecipeScanAnchor();
    }

    toListItem(): TaskListItemDto {
        return {
            id: this.task.id,
            userId: this.task.userId,
            title: this.visibleTitle(),
            slug: this.task.slug,
            status: this.task.status,
            taskKind: this.task.taskKind,
            origin: this.task.origin,
            ...(this.task.workspacePath !== null ? { workspacePath: this.task.workspacePath } : {}),
            ...(this.task.parentTaskId !== null ? { parentTaskId: this.task.parentTaskId } : {}),
            archived: this.isArchived(),
            createdAt: this.task.createdAt.toISOString(),
            updatedAt: this.task.updatedAt.toISOString(),
            ...(this.task.lastEventAt !== null ? { lastEventAt: this.task.lastEventAt.toISOString() } : {}),
        };
    }
}
