export class TodoCurrentEntity {
    id!: string;

    taskId!: string;

    title!: string;

    state!: string;

    priority!: string | null;

    autoReconciled!: number;

    lastEventId!: string | null;

    createdAt!: string;

    updatedAt!: string;
}
