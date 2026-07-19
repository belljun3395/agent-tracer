import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export interface TaskTagCreateInput {
    readonly id: string;
    readonly userId: string;
    readonly taskId: string;
    readonly tagId: string;
    readonly now: Date;
}

// 태스크와 태그의 부착 관계이며 소프트삭제 없이 떼는 행위 자체가 행 삭제다.
@Entity({ name: "task_tags" })
@Index("task_tags_unique", ["userId", "taskId", "tagId"], { unique: true })
@Index("task_tags_tag", ["userId", "tagId"])
export class TaskTagEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "tag_id", type: "text" })
    tagId!: string;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    static create(input: TaskTagCreateInput): TaskTagEntity {
        const taskTag = new TaskTagEntity();
        taskTag.id = input.id;
        taskTag.userId = input.userId;
        taskTag.taskId = input.taskId;
        taskTag.tagId = input.tagId;
        taskTag.createdAt = input.now;
        return taskTag;
    }
}
