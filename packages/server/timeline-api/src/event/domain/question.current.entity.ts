
export class QuestionCurrentEntity {
    id!: string;

    taskId!: string;

    title!: string;

    phase!: string;

    sequence!: number | null;

    modelName!: string | null;

    modelProvider!: string | null;

    lastEventId!: string | null;

    createdAt!: string;

    updatedAt!: string;
}
